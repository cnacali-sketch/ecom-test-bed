"""Order and OrderItem ORM models."""
from __future__ import annotations

import uuid
from datetime import datetime

from decimal import Decimal
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from sqlalchemy.types import JSON

from app.db import Base

# JSONB on Postgres, plain JSON on SQLite (tests) — same idiom as product.attrs.
JSONType = JSONB().with_variant(JSON(), "sqlite")


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
    # cod (cash on delivery, live today) or prepaid (online, pending the gateway).
    payment_method: Mapped[str] = mapped_column(String(16), default="cod", server_default="cod")
    # Snapshot of the delivery address AT CHECKOUT TIME — a later profile edit
    # must never rewrite where an already-placed order ships.
    shipping_address: Mapped[dict] = mapped_column(JSONType, default=dict, server_default="{}")
    courier: Mapped[str | None] = mapped_column(String(64), nullable=True)
    tracking_number: Mapped[str | None] = mapped_column(String(128), nullable=True)
    # T&C consent audit trail: which policy version was agreed to, and when.
    # Null for admin-created orders — there's no checkbox behind those (see
    # create_order's admin exception).
    terms_version: Mapped[str | None] = mapped_column(String(32), nullable=True)
    terms_accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Snapshot of the coupon applied at checkout (not a FK) — a later coupon
    # edit/deactivation must never rewrite what a past order actually paid.
    coupon_code: Mapped[str | None] = mapped_column(String(32), nullable=True)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0"), server_default="0")
    total_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    # COD confirmation deposit: an amount collected online (via Razorpay) at
    # checkout to confirm a Cash-on-Delivery order; the balance
    # (total_amount - deposit_amount) is paid on delivery. 0 for prepaid
    # orders. Non-refundable once `deposit_paid` is true.
    deposit_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0"), server_default="0")
    deposit_paid: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    # The Razorpay order id issued for THIS order at /razorpay/init. /razorpay/verify
    # requires the client-supplied razorpay_order_id to match this exact value before
    # trusting its signature — a signature is only proof of payment for the Razorpay
    # order it was actually generated for, so without this binding a signature paid
    # for one order could be replayed to mark ANY other order paid for free.
    razorpay_order_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # The id of the payment Razorpay actually captured. Distinct from
    # razorpay_order_id, which is issued BEFORE payment and does not appear on
    # a settlement report — so without this, money arriving in the bank could
    # not be tied back to an order. It is also what Razorpay's refund API
    # takes, so a refund cannot be issued from our own records without it.
    razorpay_payment_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # How much of this order has been refunded, cumulative across partial
    # refunds. Zero is "nothing refunded", never null, so arithmetic against
    # total_amount never has to guard for None.
    refund_amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("0"), server_default="0"
    )
    refunded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Whatever identifies the refund at the other end: a Razorpay refund id, a
    # UPI reference, or "cash returned in person" for a COD doorstep refund.
    refund_reference: Mapped[str | None] = mapped_column(String(128), nullable=True)
    # Server-side price-tampering signal: set when a client-sent unit_price
    # didn't match Product.price at order time. The order still gets charged
    # the CORRECT (server) price either way — this is a human-review alert,
    # not a payment gate — and fires regardless of payment_method so COD
    # tampering attempts surface too, not just gateway-mediated ones.
    flagged: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    flag_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # The IP that placed this order — separate from user_events.ip_hash: an
    # order is a specific, high-stakes action worth being able to act on
    # directly (block at the firewall) if it turns out fraudulent, not just
    # group with other visits.
    # True once this order's units have been given back to stock. Tracked as
    # state rather than inferred from `status`, because approving a return
    # already restocks AND sets status to "returned" — any rule of the form
    # "restock when the status becomes returned" would count those units
    # twice. Every release path checks this flag, so cancel / return / delete
    # compose safely in any order. See services/stock.py.
    stock_released: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # The browser that placed the order, kept verbatim so the admin can tell a
    # phone order from a desktop one and spot an obvious script. Same 256-char
    # cap as UserEvent.user_agent. Null for every order placed before this was
    # recorded, and for admin-entered phone orders.
    user_agent: Mapped[str | None] = mapped_column(String(256), nullable=True)
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
    # lazy="selectin" on purpose, not an explicit selectinload at each call
    # site. Order is serialised by nine different endpoints; under asyncio a
    # single one that forgot to eager-load would not fall back to a lazy query
    # but raise MissingGreenlet mid-response — which is exactly how the
    # collections 500 happened. Eager here means no endpoint can get it wrong.
    product: Mapped["Product"] = relationship(lazy="selectin")
