"""Product and ProductVariant ORM models."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from sqlalchemy.types import JSON

from app.db import Base

# Use JSONB on Postgres, but fall back to generic JSON so SQLite (used in
# unit tests) can still create these tables without a Postgres connection.
JSONType = JSONB().with_variant(JSON(), "sqlite")


class Product(Base):
    """A sellable product, grouping one or more `ProductVariant` rows."""

    __tablename__ = "products"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    sku: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    price: Mapped[float] = mapped_column(Numeric(10, 2))
    mrp: Mapped[float] = mapped_column(Numeric(10, 2))
    description: Mapped[str | None] = mapped_column(Text(), nullable=True)
    images: Mapped[list] = mapped_column(JSONType, default=list)
    attrs: Mapped[dict] = mapped_column(JSONType, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    variants: Mapped[list[ProductVariant]] = relationship(
        back_populates="product", cascade="all, delete-orphan"
    )


class ProductVariant(Base):
    """A purchasable variant of a `Product` (e.g. size/color combination)."""

    __tablename__ = "product_variants"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    product_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("products.id"), index=True)
    sku: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    price: Mapped[float] = mapped_column(Numeric(10, 2))
    mrp: Mapped[float] = mapped_column(Numeric(10, 2))
    description: Mapped[str | None] = mapped_column(Text(), nullable=True)
    images: Mapped[list] = mapped_column(JSONType, default=list)
    attrs: Mapped[dict] = mapped_column(JSONType, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    product: Mapped[Product] = relationship(back_populates="variants")
