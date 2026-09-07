"""Coupon endpoints.

  POST   /api/coupons/validate  — check a code against a subtotal (public;
                                   checkout calls this live as the shopper
                                   types — never increments times_used)
  POST   /api/coupons           — create a coupon (admin)
  GET    /api/coupons           — list all coupons, with usage analytics (admin)
  PATCH  /api/coupons/{id}      — edit a coupon (admin)
  DELETE /api/coupons/{id}      — delete a coupon (admin)
  GET    /api/coupons/{id}/qr   — QR code (PNG) encoding the coupon's code,
                                   for print flyers / in-person promo (admin)
"""
import io
import uuid
from datetime import datetime
from decimal import Decimal

import qrcode
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db_session
from app.dependencies.auth import require_admin
from app.models.coupon import DISCOUNT_TYPES, Coupon
from app.models.order import Order
from app.services import login_throttle
from app.services.coupons import compute_discount

router = APIRouter(prefix="/api/coupons", tags=["coupons"])

# Public and unauthenticated (checkout calls it live as the shopper types a
# code), so without a cap it's a free oracle for brute-forcing valid codes.
# Generous enough for a shopper trying a few codes by hand; nowhere near
# enough to brute-force a coupon's keyspace.
COUPON_VALIDATE_MAX_PER_IP = 20
_TOO_MANY_VALIDATIONS = HTTPException(
    status_code=429, detail="Too many coupon attempts. Try again shortly."
)


class CouponCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=32)
    discount_type: str
    value: Decimal = Field(..., gt=0, decimal_places=2)
    min_order_value: Decimal = Field(default=Decimal("0"), ge=0, decimal_places=2)
    usage_limit: int | None = Field(default=None, ge=1)
    expires_at: datetime | None = None


class CouponRead(BaseModel):
    id: uuid.UUID
    code: str
    discount_type: str
    value: Decimal
    min_order_value: Decimal
    usage_limit: int | None
    times_used: int
    expires_at: datetime | None
    active: bool
    # Usage analytics — total discount handed out and total value of orders
    # that redeemed this code, summed from `orders` (coupon_code is a string
    # snapshot on the order, not a FK, so this stays correct even if the
    # coupon is edited or deleted later).
    total_discount_given: Decimal = Decimal("0")
    total_order_value: Decimal = Decimal("0")


class CouponEdit(BaseModel):
    """Admin edit. All optional — only the sent fields change. `code` stays
    fixed post-creation: it's printed on QR flyers, so renaming it would
    silently orphan anything already handed out."""

    discount_type: str | None = None
    value: Decimal | None = Field(default=None, gt=0, decimal_places=2)
    min_order_value: Decimal | None = Field(default=None, ge=0, decimal_places=2)
    usage_limit: int | None = None
    expires_at: datetime | None = None
    active: bool | None = None


async def _get_coupon_or_404(db: AsyncSession, coupon_id: uuid.UUID) -> Coupon:
    result = await db.execute(select(Coupon).where(Coupon.id == coupon_id))
    coupon = result.scalar_one_or_none()
    if coupon is None:
        raise HTTPException(status_code=404, detail="Coupon not found")
    return coupon


async def _usage_stats(db: AsyncSession) -> dict[str, tuple[Decimal, Decimal]]:
    """{coupon_code: (total_discount_given, total_order_value)} across every order."""
    result = await db.execute(
        select(Order.coupon_code, func.sum(Order.discount_amount), func.sum(Order.total_amount))
        .where(Order.coupon_code.is_not(None))
        .group_by(Order.coupon_code)
    )
    return {code: (discount or Decimal("0"), revenue or Decimal("0")) for code, discount, revenue in result.all()}


def _to_read(coupon: Coupon, stats: dict[str, tuple[Decimal, Decimal]]) -> CouponRead:
    discount, revenue = stats.get(coupon.code, (Decimal("0"), Decimal("0")))
    return CouponRead(
        id=coupon.id,
        code=coupon.code,
        discount_type=coupon.discount_type,
        value=coupon.value,
        min_order_value=coupon.min_order_value,
        usage_limit=coupon.usage_limit,
        times_used=coupon.times_used,
        expires_at=coupon.expires_at,
        active=coupon.active,
        total_discount_given=discount,
        total_order_value=revenue,
    )


@router.post("", response_model=CouponRead, status_code=201, dependencies=[Depends(require_admin)])
async def create_coupon(payload: CouponCreate, db: AsyncSession = Depends(get_db_session)) -> CouponRead:
    if payload.discount_type not in DISCOUNT_TYPES:
        raise HTTPException(status_code=422, detail=f"discount_type must be one of {DISCOUNT_TYPES}")
    if payload.discount_type == "percent" and payload.value > 100:
        raise HTTPException(status_code=422, detail="A percent discount can't exceed 100")

    code = payload.code.strip().upper()
    existing = await db.execute(select(Coupon).where(Coupon.code == code))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="A coupon with this code already exists")

    coupon = Coupon(
        code=code,
        discount_type=payload.discount_type,
        value=payload.value,
        min_order_value=payload.min_order_value,
        usage_limit=payload.usage_limit,
        expires_at=payload.expires_at,
    )
    db.add(coupon)
    await db.commit()
    await db.refresh(coupon)
    return _to_read(coupon, {})


@router.get("", response_model=list[CouponRead], dependencies=[Depends(require_admin)])
async def list_coupons(db: AsyncSession = Depends(get_db_session)) -> list[CouponRead]:
    result = await db.execute(select(Coupon).order_by(Coupon.created_at.desc()))
    stats = await _usage_stats(db)
    return [_to_read(c, stats) for c in result.scalars().all()]


@router.patch("/{coupon_id}", response_model=CouponRead, dependencies=[Depends(require_admin)])
async def update_coupon(
    coupon_id: uuid.UUID,
    payload: CouponEdit,
    db: AsyncSession = Depends(get_db_session),
) -> CouponRead:
    """Edit a coupon. Admin-gated. `code` stays fixed (see CouponEdit); every
    other field — discount type/value/min order, usage limit, expiry, active —
    is editable and applies from this point forward. Past orders keep their
    own snapshotted discount_amount, so editing a coupon never rewrites
    history, only what happens on the *next* redemption."""
    coupon = await _get_coupon_or_404(db, coupon_id)
    if payload.discount_type is not None:
        if payload.discount_type not in DISCOUNT_TYPES:
            raise HTTPException(status_code=422, detail=f"discount_type must be one of {DISCOUNT_TYPES}")
        coupon.discount_type = payload.discount_type
    effective_type = payload.discount_type or coupon.discount_type
    if payload.value is not None:
        if effective_type == "percent" and payload.value > 100:
            raise HTTPException(status_code=422, detail="A percent discount can't exceed 100")
        coupon.value = payload.value
    if payload.min_order_value is not None:
        coupon.min_order_value = payload.min_order_value
    if payload.usage_limit is not None:
        coupon.usage_limit = payload.usage_limit
    if payload.expires_at is not None:
        coupon.expires_at = payload.expires_at
    if payload.active is not None:
        coupon.active = payload.active
    await db.commit()
    await db.refresh(coupon)
    stats = await _usage_stats(db)
    return _to_read(coupon, stats)


@router.delete("/{coupon_id}", status_code=204, dependencies=[Depends(require_admin)])
async def delete_coupon(coupon_id: uuid.UUID, db: AsyncSession = Depends(get_db_session)) -> None:
    """Delete a coupon. Admin-gated. Safe at any time: `orders.coupon_code` is
    a string snapshot, not a foreign key, so past orders that used this code
    keep their own record of it — deleting the coupon just retires the code
    for future checkouts."""
    coupon = await _get_coupon_or_404(db, coupon_id)
    await db.delete(coupon)
    await db.commit()


class CouponValidate(BaseModel):
    code: str = Field(..., min_length=1, max_length=32)
    subtotal: Decimal = Field(..., ge=0, decimal_places=2)


class CouponValidateResponse(BaseModel):
    valid: bool
    code: str
    discount_amount: Decimal


@router.post("/validate", response_model=CouponValidateResponse)
async def validate_coupon(
    payload: CouponValidate, request: Request, db: AsyncSession = Depends(get_db_session)
) -> CouponValidateResponse:
    throttle_key = login_throttle.client_key(request, "coupon-validate")
    if login_throttle.is_locked(throttle_key, COUPON_VALIDATE_MAX_PER_IP):
        raise _TOO_MANY_VALIDATIONS
    login_throttle.record_failure(throttle_key)

    result = await db.execute(select(Coupon).where(Coupon.code == payload.code.strip().upper()))
    coupon = result.scalar_one_or_none()
    if coupon is None:
        raise HTTPException(status_code=422, detail="Invalid coupon code")
    discount = compute_discount(coupon, payload.subtotal)
    return CouponValidateResponse(valid=True, code=coupon.code, discount_amount=discount)


@router.get("/{coupon_id}/qr", dependencies=[Depends(require_admin)])
async def coupon_qr(coupon_id: uuid.UUID, db: AsyncSession = Depends(get_db_session)) -> Response:
    """A QR code (PNG) encoding this coupon's bare code string, for print
    flyers / in-person promo. Encodes the code itself, not a URL — there's no
    stable production domain yet (storefront is tunnel-hosted); regenerate
    once a real domain exists if a scan-to-prefill link is wanted instead."""
    coupon = await _get_coupon_or_404(db, coupon_id)
    img = qrcode.make(coupon.code)
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return Response(content=buffer.getvalue(), media_type="image/png")
