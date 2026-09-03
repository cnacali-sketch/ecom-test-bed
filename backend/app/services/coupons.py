"""Coupon discount math — shared between the live validate-as-you-type
endpoint (routers/coupons.py) and the authoritative redemption inside order
creation (routers/orders.py). Both must apply the exact same rules; only
redemption additionally locks the row and increments times_used.
"""
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException

from app.models.coupon import Coupon


def compute_discount(coupon: Coupon, subtotal: Decimal) -> Decimal:
    """Validate `coupon` against `subtotal` and return the discount amount.

    Raises:
        HTTPException(422): the coupon isn't usable right now, with a
        customer-facing reason (inactive, expired, exhausted, order too small).
    """
    if not coupon.active:
        raise HTTPException(status_code=422, detail="This coupon is no longer active")
    expires_at = coupon.expires_at
    if expires_at is not None and expires_at.tzinfo is None:
        # SQLite (tests) round-trips DateTime(timezone=True) as naive, unlike
        # Postgres — always written as UTC, so treat a naive read-back as UTC
        # rather than crash on a naive/aware comparison.
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at and datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=422, detail="This coupon has expired")
    if coupon.usage_limit is not None and coupon.times_used >= coupon.usage_limit:
        raise HTTPException(status_code=422, detail="This coupon has reached its usage limit")
    if subtotal < coupon.min_order_value:
        raise HTTPException(
            status_code=422, detail=f"Minimum order value for this coupon is {coupon.min_order_value}"
        )

    if coupon.discount_type == "percent":
        discount = (subtotal * coupon.value / Decimal(100)).quantize(Decimal("0.01"))
    else:
        discount = coupon.value
    return min(discount, subtotal)
