"""Order and OrderItem ORM models."""
from __future__ import annotations

import uuid
from datetime import datetime

from decimal import Decimal
from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db import Base


class Order(Base):
    """A customer order, composed of one or more `OrderItem` rows."""

    __tablename__ = "orders"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    # Fulfilment lifecycle: pending → confirmed → shipped → delivered, plus the
    # off-ramps cancelled / returned.
    status: Mapped[str] = mapped_column(String(32), default="pending")
    # Payment lifecycle, tracked separately from fulfilment: unpaid → paid →
    # refunded. Set manually by an admin until the payment gateway is wired,
    # at which point the gateway webhook becomes the source of truth.
    payment_status: Mapped[str] = mapped_column(String(16), default="unpaid", server_default="unpaid")
    total_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    items: Mapped[list[OrderItem]] = relationship(
        back_populates="order", cascade="all, delete-orphan"
    )


class OrderItem(Base):
    """A single line item within an `Order`."""

    __tablename__ = "order_items"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("orders.id"), index=True)
    product_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("products.id"), index=True)
    quantity: Mapped[int] = mapped_column(Integer())
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))

    order: Mapped[Order] = relationship(back_populates="items")
