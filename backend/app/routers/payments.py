"""Razorpay webhook — server-authoritative order payment status.

The browser's synchronous /razorpay/verify is the primary path, but if a
customer closes the tab right after paying, that round-trip never happens.
Razorpay then calls THIS endpoint server-to-server on `payment.captured`, so
the order is still marked paid (prepaid) / deposit-collected (COD) regardless
of the browser. `refund.processed` auto-marks an order refunded.
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db_session
from app.models.order import Order
from app.routers.orders import _resolve_order_email
from app.services import audit
from app.services.email import send_order_confirmation_email
from app.services.razorpay import verify_webhook_signature

router = APIRouter(prefix="/api/payments", tags=["payments"])

HANDLED_EVENTS = {"payment.captured", "refund.processed"}


@router.post("/razorpay/webhook")
async def razorpay_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_razorpay_signature: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    raw = await request.body()
    if not verify_webhook_signature(raw, x_razorpay_signature or ""):
        raise HTTPException(status_code=401, detail="Invalid signature")

    try:
        payload = json.loads(raw.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    event = payload.get("event")
    if event not in HANDLED_EVENTS:
        return {"ok": True, "ignored": event}  # always ack so Razorpay stops retrying

    payment = (payload.get("payload") or {}).get("payment") or {}
    entity = payment.get("entity") or {}
    internal_order_id = (entity.get("notes") or {}).get("order_id")
    if not internal_order_id:
        return {"ok": True, "ignored": "no internal order_id in payment notes"}

    try:
        order_uuid = uuid.UUID(str(internal_order_id))
    except ValueError:
        return {"ok": True, "ignored": "invalid internal order_id"}

    result = await db.execute(select(Order).where(Order.id == order_uuid))
    order = result.scalar_one_or_none()
    if order is None:
        return {"ok": True, "ignored": "order not found"}

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

    if changed:
        # Attributed to the webhook, never to a signed-in admin: nobody is
        # signed in when Razorpay calls, and naming whoever logged in most
        # recently would be a confident lie in the record meant to settle
        # arguments about money.
        await audit.record(
            db,
            actor=audit.SYSTEM_RAZORPAY,
            action=f"order.{event.replace('.', '_')}",
            entity_type="order",
            entity_id=order.id,
            entity_label=audit.order_label(order.id),
            summary=f"Razorpay reported {event} for {audit.order_label(order.id)}",
            changes={
                "payment_status": {"from": None, "to": order.payment_status},
                "refund_amount": {"from": None, "to": order.refund_amount},
            },
        )
        await db.commit()
        # Send the confirmation email only when THIS call actually flipped the
        # state — so a fast synchronous /razorpay/verify and a later webhook
        # don't double-send.
        if event == "payment.captured":
            notify_email = await _resolve_order_email(db, order)
            if notify_email:
                background_tasks.add_task(
                    send_order_confirmation_email, notify_email, str(order.id)
                )

    return {"ok": True}
