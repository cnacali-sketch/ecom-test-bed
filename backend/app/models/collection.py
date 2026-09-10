"""Collection ORM model — the core navigation unit for the storefront.

A Collection groups Products for display (e.g. "Hair Accessories",
"Jewellery"). The many-to-many join is through `product_collections`.
Collections are managed from content/catalog.ts and seeded alongside
products; they are not created via the API in Phase 1.
"""
from __future__ import annotations

import uuid

from sqlalchemy import Column, ForeignKey, String, Table, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


# Association table — no ORM class needed (ponytail: simple join, no extra cols)
product_collections = Table(
    "product_collections",
    Base.metadata,
    Column("product_id", ForeignKey("products.id", ondelete="CASCADE"), primary_key=True),
    Column("collection_id", ForeignKey("collections.id", ondelete="CASCADE"), primary_key=True),
)


class Collection(Base):
    """A named grouping of products (e.g. Hair Accessories, Jewellery)."""

    __tablename__ = "collections"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text(), nullable=True)
    hero_image: Mapped[str | None] = mapped_column(Text(), nullable=True)

    # Mapped[list["Product"]], not a bare Mapped[list]. SQLAlchemy 2.0 decides
    # uselist from the annotation's type argument; without one it cannot tell
    # this is a collection, configures the relationship as a scalar, and hands
    # back a single Product. GET /api/collections/{slug} then died with
    # "'Product' object is not iterable" — a 500 the storefront hid, because it
    # silently falls back to the bundled catalogue on API failure.
    products: Mapped[list["Product"]] = relationship(
        "Product", secondary=product_collections, back_populates="collections"
    )
