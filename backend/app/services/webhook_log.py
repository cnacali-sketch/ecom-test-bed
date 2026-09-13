"""Writing down that a webhook arrived, before finding out whether it works.

The ordering is the whole design. The delivery row is inserted and **committed**
before the handler runs, so that a handler which raises still leaves a record
behind. A row written in the same transaction as the work would disappear with
it, which is exactly the failure this exists to make visible.

That also means the failure path has to rollback before it can write: once a
statement has raised, the session is unusable until it does. The earlier commit
is not affected -- a rollback undoes the current transaction, not a finished
one.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.webhook_delivery import WebhookDelivery

#: How many rejected deliveries one address can put in the table per window.
#:
#: This endpoint is public and unauthenticated, and it now writes a row for a
#: delivery that fails its signature check -- which is worth having, because a
#: run of them is somebody probing the payment webhook and that is precisely
#: the thing nobody would otherwise see. But it would also be a way for anyone
#: to fill the table, so the recording is capped. The 401 is unaffected: a
#: forged delivery is always refused, whether or not it is written down.
REJECT_LOG_MAX_PER_IP = 10


async def record(
    db: AsyncSession,
    *,
    event: str | None,
    event_id: str | None,
    signature_valid: bool,
    payload: dict | None,
    status: str,
    detail: str | None = None,
    order_id: uuid.UUID | None = None,
    provider: str = "razorpay",
) -> WebhookDelivery:
    """Insert a delivery row and commit it immediately."""
    delivery = WebhookDelivery(
        provider=provider,
        event=event,
        event_id=event_id,
        signature_valid=signature_valid,
        payload=payload,
        status=status,
        detail=detail[:2000] if detail else None,
        order_id=order_id,
    )
    db.add(delivery)
    await db.commit()
    await db.refresh(delivery)
    return delivery


async def finish(
    db: AsyncSession,
    delivery_id: uuid.UUID,
    *,
    status: str,
    detail: str | None = None,
    order_id: uuid.UUID | None = None,
) -> None:
    """Record how a delivery ended.

    Looked up by id rather than taking the instance, because the caller may
    have rolled its session back between the insert and this call -- which
    detaches the object it was holding.
    """
    delivery = await db.get(WebhookDelivery, delivery_id)
    if delivery is None:  # pragma: no cover - the row was just committed
        return
    delivery.status = status
    delivery.detail = detail[:2000] if detail else None
    delivery.processed_at = datetime.now(timezone.utc)
    if order_id is not None:
        delivery.order_id = order_id
    await db.commit()


async def latest(
    db: AsyncSession, *, status: str | None = None, limit: int = 50
) -> list[WebhookDelivery]:
    """Deliveries, newest first."""
    query = select(WebhookDelivery).order_by(WebhookDelivery.received_at.desc())
    if status is not None:
        query = query.where(WebhookDelivery.status == status)
    return list((await db.execute(query.limit(limit))).scalars().all())
