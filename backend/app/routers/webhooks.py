"""What Razorpay sent, and the ability to run it again.

Admin-gated throughout. A delivery payload names a payment id, an amount and
an order, which is the shop's commercial record and, read together, a fair
amount about one customer's purchase.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db_session
from app.dependencies.auth import require_admin
from app.models.user import User
from app.models.webhook_delivery import DELIVERY_STATUSES, WebhookDelivery
from app.routers.payments import apply_event
from app.services import audit, webhook_log

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


class DeliveryRead(BaseModel):
    """A delivery, without the body."""

    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    provider: str
    event: str | None
    event_id: str | None
    signature_valid: bool
    status: str
    detail: str | None
    order_id: uuid.UUID | None
    received_at: datetime
    processed_at: datetime | None
    attempts: int


class DeliveryDetailRead(DeliveryRead):
    """A delivery with the body Razorpay sent."""

    payload: dict | None


@router.get("", response_model=list[DeliveryRead], dependencies=[Depends(require_admin)])
async def list_deliveries(
    status: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db_session),
) -> list[WebhookDelivery]:
    """Deliveries, newest first.

    The payload is left out here on purpose: this is the screen someone opens
    when they want to know whether anything has been failing, and fifty
    payment bodies is both a slow response and more of the shop's payment
    detail on screen than the question needed.
    """
    if status is not None and status not in DELIVERY_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown status. Expected one of: {', '.join(sorted(DELIVERY_STATUSES))}",
        )
    return await webhook_log.latest(db, status=status, limit=limit)


@router.get(
    "/{delivery_id}",
    response_model=DeliveryDetailRead,
    dependencies=[Depends(require_admin)],
)
async def get_delivery(
    delivery_id: uuid.UUID, db: AsyncSession = Depends(get_db_session)
) -> WebhookDelivery:
    delivery = await db.get(WebhookDelivery, delivery_id)
    if delivery is None:
        raise HTTPException(status_code=404, detail="Delivery not found")
    return delivery


@router.post("/{delivery_id}/replay", response_model=DeliveryRead)
async def replay_delivery(
    delivery_id: uuid.UUID,
    request: Request,
    actor: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db_session),
) -> WebhookDelivery:
    """Run a stored delivery through the handler again.

    This is the recovery path for a delivery that failed on our side. The
    handlers are written to be idempotent -- Razorpay reports a cumulative
    refund total, and the capture handler checks the state before changing it
    -- so replaying something that already worked changes nothing and says so.

    The signature is **not** re-checked, and that is a deliberate decision
    rather than an oversight. It was checked when the delivery arrived, which
    is recorded in the row; re-checking would require keeping the raw bytes,
    and it would fail for every stored delivery the day the webhook secret is
    rotated -- exactly when replaying is most likely to be needed. A delivery
    that failed its signature check is refused here instead, because it was
    never ours to act on.

    Replaying is audited against the admin who asked for it. The order change
    underneath is still attributed to the webhook, because the payload is
    Razorpay's -- but somebody chose this moment, and the audit trail should
    say who.
    """
    delivery = await db.get(WebhookDelivery, delivery_id)
    if delivery is None:
        raise HTTPException(status_code=404, detail="Delivery not found")

    if not delivery.signature_valid:
        raise HTTPException(
            status_code=409,
            detail="This delivery failed its signature check when it arrived and was "
            "never acted on. Replaying it would act on an unverified payload.",
        )
    if delivery.payload is None:
        raise HTTPException(
            status_code=409, detail="This delivery has no stored payload to replay."
        )

    await audit.record(
        db,
        actor=actor,
        request=request,
        action="webhook.replay",
        entity_type="webhook_delivery",
        entity_id=delivery.id,
        entity_label=delivery.event or "webhook",
        summary=f"Replayed the {delivery.event or 'unknown'} webhook delivery",
        changes={"attempts": {"from": delivery.attempts, "to": delivery.attempts + 1}},
    )
    await db.commit()

    try:
        outcome = await apply_event(db, delivery.payload, replay=True)
    except Exception as exc:
        await db.rollback()
        await webhook_log.finish(
            db, delivery_id, status="failed", detail=f"replay: {type(exc).__name__}: {exc}"
        )
        raise HTTPException(
            status_code=502,
            detail=f"The replay failed the same way: {type(exc).__name__}: {exc}",
        )

    delivery = await db.get(WebhookDelivery, delivery_id)
    delivery.attempts += 1
    await db.commit()
    await webhook_log.finish(
        db,
        delivery_id,
        status=outcome.status,
        detail=f"replay: {outcome.detail}" if outcome.detail else "replay",
        order_id=outcome.order_id,
    )
    return await db.get(WebhookDelivery, delivery_id)
