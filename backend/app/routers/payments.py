"""Razorpay webhook — server-authoritative order payment status.

The browser's synchronous /razorpay/verify is the primary path, but if a
customer closes the tab right after paying, that round-trip never happens.
Razorpay then calls THIS endpoint server-to-server on `payment.captured`, so
the order is still marked paid (prepaid) / deposit-collected (COD) regardless
of the browser. `refund.processed` auto-marks an order refunded.

Every delivery is written to `webhook_deliveries` before it is processed, so
that one which fails leaves a record rather than a silence. See
`services/webhook_log.py` for why the ordering matters.
"""
from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db_session
from app.models.order import Order
from app.routers.orders import _resolve_order_email
from app.services import audit, login_throttle, webhook_log
from app.services.email import send_order_confirmation_email
from app.services.razorpay import verify_webhook_signature

router = APIRouter(prefix="/api/payments", tags=["payments"])

HANDLED_EVENTS = {"payment.captured", "refund.processed"}


@dataclass(frozen=True)
class Outcome:
    """What a delivery did.

    `detail` is for the delivery log and says as much as it can. `ignored` is
    the reason echoed back in the response body, and exists separately only to
    keep that body what it was before this endpoint started logging -- adding a
    record of what happened should not change what the endpoint says happened.
    """

    status: str
    detail: str | None = None
    order_id: uuid.UUID | None = None
    ignored: str | None = None


async def apply_event(
    db: AsyncSession,
    payload: dict,
    *,
    background_tasks: BackgroundTasks | None = None,
    replay: bool = False,
) -> Outcome:
    """Apply one Razorpay event to the order it names.

    Extracted from the endpoint so that a replay runs the same code rather than
    a second copy of it -- a replay that drifted from the live handler would be
    worse than no replay, because it would be trusted.

    Every `Outcome` with status "ignored" is a case that used to return 200 and
    leave nothing behind. They are the reason the log exists: "we never saw it"
    and "we saw it and there was nothing to do" are indistinguishable from the
    outside and mean completely different things.
    """
    event = payload.get("event")
    if event not in HANDLED_EVENTS:
        return Outcome("ignored", f"unhandled event: {event}", ignored=event)

    payment = (payload.get("payload") or {}).get("payment") or {}
    entity = payment.get("entity") or {}
    internal_order_id = (entity.get("notes") or {}).get("order_id")
    if not internal_order_id:
        return Outcome(
            "ignored",
            "no internal order_id in payment notes",
            ignored="no internal order_id in payment notes",
        )

    try:
        order_uuid = uuid.UUID(str(internal_order_id))
    except ValueError:
        return Outcome(
            "ignored",
            f"invalid internal order_id: {internal_order_id!r}",
            ignored="invalid internal order_id",
        )

    result = await db.execute(select(Order).where(Order.id == order_uuid))
    order = result.scalar_one_or_none()
    if order is None:
        return Outcome(
            "ignored", "order not found", order_id=order_uuid, ignored="order not found"
        )

    # The payment id is on the entity for both handled events. Recorded
    # whenever it is missing — the browser round-trip usually sets it, but this
    # webhook is the path that runs when the customer closed the tab, and
    # without it a bank settlement cannot be tied back to this order.
    payment_id = entity.get("id")
    changed = False
    if payment_id and not order.razorpay_payment_id:
        order.razorpay_payment_id = str(payment_id)[:64]
        changed = True

    if event == "payment.captured":
        if order.payment_method == "cod":
            if not order.deposit_paid:
                order.deposit_paid = True
                changed = True
        else:  # prepaid
            if order.payment_status != "paid":
                order.payment_status = "paid"
                changed = True
    elif event == "refund.processed":
        # Razorpay reports amount_refunded in paise, cumulative across every
        # refund on the payment — so it is assigned, not added to, and a
        # repeated webhook for the same refund is idempotent.
        refunded_paise = entity.get("amount_refunded")
        if isinstance(refunded_paise, int) and refunded_paise > 0:
            refunded = (Decimal(refunded_paise) / 100).quantize(Decimal("0.01"))
            # Never claim more came back than the order was worth: Razorpay is
            # authoritative about its own payment, but a deposit-only COD
            # payment is smaller than the order total and must not read as a
            # full refund of the order.
            capped = min(refunded, order.total_amount)
            if capped != order.refund_amount:
                order.refund_amount = capped
                order.refunded_at = datetime.now(timezone.utc)
                changed = True
        status = (
            "refunded"
            if order.refund_amount >= order.total_amount and order.refund_amount > 0
            else "partially_refunded"
        )
        if order.payment_status != status:
            order.payment_status = status
            changed = True

    if not changed:
        return Outcome(
            "ignored", "nothing to change", order_id=order.id, ignored="nothing to change"
        )

    # Attributed to the webhook, never to a signed-in admin: nobody is
    # signed in when Razorpay calls, and naming whoever logged in most
    # recently would be a confident lie in the record meant to settle
    # arguments about money.
    #
    # A replay says so in the summary. It is still the webhook's change --
    # the payload is Razorpay's -- but an admin chose the moment, and an
    # audit trail that hid that would be missing the only human in the story.
    await audit.record(
        db,
        actor=audit.SYSTEM_RAZORPAY,
        action=f"order.{event.replace('.', '_')}",
        entity_type="order",
        entity_id=order.id,
        entity_label=audit.order_label(order.id),
        summary=(
            f"Razorpay reported {event} for {audit.order_label(order.id)}"
            + (" (replayed by an admin)" if replay else "")
        ),
        changes={
            "payment_status": {"from": None, "to": order.payment_status},
            "refund_amount": {"from": None, "to": order.refund_amount},
        },
    )
    await db.commit()

    # Send the confirmation email only when THIS call actually flipped the
    # state — so a fast synchronous /razorpay/verify and a later webhook
    # don't double-send. A replay never emails: the customer was told at the
    # time, and a second confirmation months later for an operational retry
    # would be alarming rather than informative.
    if event == "payment.captured" and background_tasks is not None and not replay:
        notify_email = await _resolve_order_email(db, order)
        if notify_email:
            background_tasks.add_task(
                send_order_confirmation_email, notify_email, str(order.id)
            )

    return Outcome("processed", f"{event} applied", order_id=order.id)


@router.post("/razorpay/webhook")
async def razorpay_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_razorpay_signature: str | None = Header(default=None),
    x_razorpay_event_id: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    raw = await request.body()

    if not verify_webhook_signature(raw, x_razorpay_signature or ""):
        # Recorded, but capped and without the body. A run of these is somebody
        # probing the payment webhook, which is worth being able to see; an
        # uncapped one would let them fill the table, and storing an unverified
        # payload would mean keeping whatever a stranger chose to send.
        reject_key = login_throttle.client_key(request, "webhook-reject")
        if not login_throttle.is_locked(reject_key, webhook_log.REJECT_LOG_MAX_PER_IP):
            login_throttle.record_failure(reject_key)
            await webhook_log.record(
                db,
                event=None,
                event_id=x_razorpay_event_id,
                signature_valid=False,
                payload=None,
                status="rejected",
                detail=f"signature check failed ({len(raw)} byte body)",
            )
        raise HTTPException(status_code=401, detail="Invalid signature")

    try:
        payload = json.loads(raw.decode("utf-8"))
    except Exception:
        await webhook_log.record(
            db,
            event=None,
            event_id=x_razorpay_event_id,
            signature_valid=True,
            payload=None,
            status="rejected",
            detail="body passed the signature check but is not JSON",
        )
        raise HTTPException(status_code=400, detail="Invalid JSON")

    if not isinstance(payload, dict):
        await webhook_log.record(
            db,
            event=None,
            event_id=x_razorpay_event_id,
            signature_valid=True,
            payload=None,
            status="rejected",
            detail=f"expected a JSON object, got {type(payload).__name__}",
        )
        raise HTTPException(status_code=400, detail="Invalid JSON")

    delivery = await webhook_log.record(
        db,
        event=payload.get("event"),
        event_id=x_razorpay_event_id,
        signature_valid=True,
        payload=payload,
        status="received",
    )
    # Held as a plain UUID, not read off the instance later. The failure path
    # below rolls the session back, which expires every loaded object -- and
    # reading an expired attribute triggers a lazy refresh, which is IO, which
    # raises MissingGreenlet from inside the exception handler and replaces the
    # real error with a confusing one.
    delivery_id = delivery.id

    try:
        outcome = await apply_event(db, payload, background_tasks=background_tasks)
    except Exception as exc:
        # The session is unusable after a failed statement, so it is rolled
        # back before the delivery row can be updated. The insert above was
        # already committed, so the record survives regardless.
        await db.rollback()
        await webhook_log.finish(
            db, delivery_id, status="failed", detail=f"{type(exc).__name__}: {exc}"
        )
        # Re-raised on purpose. Razorpay retries a non-2xx, and a retry after
        # the bug is fixed is the cheapest possible recovery -- which is what
        # did not happen when the refund handler was writing a value the
        # column could not hold.
        raise

    await webhook_log.finish(
        db,
        delivery_id,
        status=outcome.status,
        detail=outcome.detail,
        order_id=outcome.order_id,
    )
    body = {"ok": True, "status": outcome.status}
    if outcome.ignored is not None:
        body["ignored"] = outcome.ignored
    return body
