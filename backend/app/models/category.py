"""Product category ORM model.

Distinct from `Collection` (Hair Accessories / Jewellery / Charms — the
storefront's top-level nav, seeded from catalog.ts and read-only via the
API). Category is a finer, admin-only tagging layer used for internal
reporting (ProductEditor's "Category" field, filed under a parent grouping)
and never rendered on the public storefront.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100))
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    parent: Mapped[str] = mapped_column(String(100), default="", server_default="")
    image: Mapped[str] = mapped_column(String(500), default="", server_default="")
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
