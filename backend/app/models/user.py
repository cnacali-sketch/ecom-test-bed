"""User ORM model — customers and admins share one table, split by `role`.

Two roles exist in P1: "customer" (storefront account) and "admin" (gates
/admin and every write endpoint). `is_verified` is written by the P2 email
OTP flow; P1 creates users already-unverified and does not enforce it yet.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from sqlalchemy.types import JSON

from app.db import Base

ROLE_CUSTOMER = "customer"
ROLE_ADMIN = "admin"

# JSONB on Postgres, plain JSON on SQLite (tests) — same idiom as product.attrs.
JSONType = JSONB().with_variant(JSON(), "sqlite")


class User(Base):
    """An authenticated account. Email is the login identity."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    # Stored lowercased (see normalize_email) so logins are case-insensitive.
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(128))
    role: Mapped[str] = mapped_column(String(16), default=ROLE_CUSTOMER)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # ---- Customer profile (self-editable via PATCH /api/profile) ----
    full_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    # Address blobs: {line1, line2, city, state, postcode, country}. Free-form
    # JSON keeps the shape flexible without a migration per field.
    postal_address: Mapped[dict] = mapped_column(JSONType, default=dict, server_default="{}")
    billing_address: Mapped[dict] = mapped_column(JSONType, default=dict, server_default="{}")
    # When true, billing == postal and billing_address is ignored by consumers.
    billing_same: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")

    @property
    def is_admin(self) -> bool:
        return self.role == ROLE_ADMIN


def normalize_email(email: str) -> str:
    """Lowercase + strip so `A@B.com ` and `a@b.com` are the same account."""
    return email.strip().lower()
