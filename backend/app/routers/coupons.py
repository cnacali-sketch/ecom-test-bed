"""Coupon endpoints.

  POST   /api/coupons/validate  — check a code against a subtotal (public;
                                   checkout calls this live as the shopper
                                   types — never increments times_used)
  POST   /api/coupons           — create a coupon (admin)
  GET    /api/coupons           — list all coupons (admin)
  PATCH  /api/coupons/{id}      — edit/deactivate a coupon (admin)
  GET    /api/coupons/{id}/qr   — QR code (PNG) encoding the coupon's code,
                                   for print flyers / in-person promo (admin)
"""
import io
import uuid
from datetime import datetime
from decimal import Decimal

import qrcode
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db_session
from app.dependencies.auth import require_admin
from app.models.coupon import DISCOUNT_TYPES, Coupon
from app.services.coupons import compute_discount

router = APIRouter(prefix="/api/coupons", tags=["coupons"])


class CouponCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=32)
    discount_type: str
    value: Decimal = Field(..., gt=0, decimal_places=2)
    min_order_value: Decimal = Field(default=Decimal("0"), ge=0, decimal_places=2)
    usage_limit: int | None = Field(default=None, ge=1)
    expires_at: datetime | None = None


class CouponRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    code: str
    discount_type: str
    value: Decimal
    min_order_value: Decimal
    usage_limit: int | None
    times_used: int
    expires_at: datetime | None
    active: bool


async def _get_coupon_or_404(db: AsyncSession, coupon_id: uuid.UUID) -> Coupon:
    result = await db.execute(select(Coupon).where(Coupon.id == coupon_id))
    coupon = result.scalar_one_or_none()
    if coupon is None:
        raise HTTPException(status_code=404, detail="Coupon not found")
    return coupon


@router.post("", response_model=CouponRead, status_code=201, dependencies=[Depends(require_admin)])
async def create_coupon(payload: CouponCreate, db: AsyncSession = Depends(get_db_session)) -> Coupon:
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
    return coupon


@router.get("", response_model=list[CouponRead], dependencies=[Depends(require_admin)])
async def list_coupons(db: AsyncSession = Depends(get_db_session)) -> list[Coupon]:
    result = await db.execute(select(Coupon).order_by(Coupon.created_at.desc()))
    return list(result.scalars().all())


@router.patch("/{coupon_id}", response_model=CouponRead, dependencies=[Depends(require_admin)])
async def update_coupon(
    coupon_id: uuid.UUID,
    active: bool | None = None,
    usage_limit: int | None = None,
    expires_at: datetime | None = None,
    db: AsyncSession = Depends(get_db_session),
) -> Coupon:
    """Edit a coupon. Admin-gated. Only `active`, `usage_limit`, and
    `expires_at` are editable post-creation — code/discount/value/min-order
    stay fixed so a mid-flight edit can't retroactively change what an
    in-progress checkout is validating against."""
    coupon = await _get_coupon_or_404(db, coupon_id)
    if active is not None:
        coupon.active = active
    if usage_limit is not None:
        coupon.usage_limit = usage_limit
    if expires_at is not None:
        coupon.expires_at = expires_at
    await db.commit()
    await db.refresh(coupon)
    return coupon


class CouponValidate(BaseModel):
    code: str = Field(..., min_length=1, max_length=32)
    subtotal: Decimal = Field(..., ge=0, decimal_places=2)


class CouponValidateResponse(BaseModel):
    valid: bool
    code: str
    discount_amount: Decimal


@router.post("/validate", response_model=CouponValidateResponse)
async def validate_coupon(payload: CouponValidate, db: AsyncSession = Depends(get_db_session)) -> CouponValidateResponse:
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
