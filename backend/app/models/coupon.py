"""Coupon ORM model."""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base

DISCOUNT_TYPES = {"percent", "flat"}


class Coupon(Base):
    """A discount code, redeemable once per order at checkout."""

    __tablename__ = "coupons"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    discount_type: Mapped[str] = mapped_column(String(16))  # "percent" | "flat"
    value: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    min_order_value: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0"), server_default="0")
    # None = unlimited. Incremented atomically (row-locked) when an order
    # actually redeems the code — never on a live validate-as-you-type check.
    usage_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    times_used: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
