"""Product and ProductVariant ORM models."""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from app.models.collection import Collection
from sqlalchemy.sql import func
from sqlalchemy.types import JSON

from app.db import Base

# ponytail: JSONB→JSON fallback keeps SQLite working in tests without Postgres.
JSONType = JSONB().with_variant(JSON(), "sqlite")


class Product(Base):
    """A sellable product, grouping one or more `ProductVariant` rows."""

    __tablename__ = "products"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    sku: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    # slug promoted from attrs blob: drives /api/products/slug/{slug} lookup.
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    mrp: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    # in_stock promoted from attrs blob: filterable without JSON scan.
    in_stock: Mapped[bool] = mapped_column(Boolean, default=True)
    description: Mapped[str | None] = mapped_column(Text(), nullable=True)
    images: Mapped[list] = mapped_column(JSONType, default=list)
    # attrs: remaining display-only fields (brand, type, material, tags, etc.)
    attrs: Mapped[dict] = mapped_column(JSONType, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    variants: Mapped[list[ProductVariant]] = relationship(
        back_populates="product", cascade="all, delete-orphan"
    )
    collections: Mapped[list["Collection"]] = relationship(
        "Collection",
        secondary="product_collections",
        back_populates="products",
    )


class ProductVariant(Base):
    """A purchasable variant of a `Product` (e.g. colour/finish, size).

    Everything added here is nullable, and null means "take the parent's
    answer". That is what makes this additive: the fifty variants already in
    the database say nothing about size, price or quantity, and they go on
    behaving exactly as they did -- colour and a swatch, priced by the product.

    **`price` and `mrp` move together on purpose.** A variant with its own
    price but the parent's MRP would render a discount percentage computed from
    two unrelated numbers, which is worse than showing no discount at all: the
    shop would be advertising a saving it never offered. If one is set the other
    should be too, and both being null is the normal case.

    **`stock_quantity` is nullable rather than zero-by-default.** Null means
    nobody is counting this variant, which is the honest state for fifty rows
    that were never counted; zero would mean "sold out" and would take the whole
    catalogue off sale the moment this column existed.
    """

    __tablename__ = "product_variants"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    product_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("products.id"), index=True)
    sku: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    color: Mapped[str] = mapped_column(String(64))
    color_hex: Mapped[str] = mapped_column(String(16))
    image: Mapped[str | None] = mapped_column(Text(), nullable=True)
    in_stock: Mapped[bool] = mapped_column(Boolean, default=True)

    # ---- Added in Phase 10; null everywhere until an admin fills them in ----
    size: Mapped[str | None] = mapped_column(String(32), nullable=True)
    price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    mrp: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    stock_quantity: Mapped[int | None] = mapped_column(Integer(), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    product: Mapped[Product] = relationship(back_populates="variants")
