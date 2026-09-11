"""User ORM model — customers and back-office accounts share one table,
split by `role`.

Three roles: "customer" (storefront account), "staff" (fulfilment: sees
orders, moves them through dispatch, touches no money) and "admin" (the
owner; everything). `is_verified` is written by the P2 email OTP flow; P1
creates users already-unverified and does not enforce it yet.
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
# Fulfilment without money. Staff can see orders, move them through picking,
# packing and dispatch, and flag one for the owner's attention — but cannot
# refund, delete, edit the catalogue, or open the customer directory. The
# split exists so a second pair of hands does not require handing over the
# keys to the till.
ROLE_STAFF = "staff"
ROLE_ADMIN = "admin"

# Every role that may exist on an account. Used to reject anything else at
# the role-assignment endpoint, so a typo cannot create an account that
# silently matches no permission check at all.
ROLES = (ROLE_CUSTOMER, ROLE_STAFF, ROLE_ADMIN)

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

    # ---- Admin blacklist (see routers/customers.py) ----
    is_blocked: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    blocked_reason: Mapped[str | None] = mapped_column(String(300), nullable=True)

    @property
    def is_admin(self) -> bool:
        return self.role == ROLE_ADMIN

    @property
    def is_staff(self) -> bool:
        """Anyone who may work the back office. An admin is always staff —
        the roles are a ladder, not a set of separate boxes, so every check
        written against staff keeps working for the owner."""
        return self.role in (ROLE_STAFF, ROLE_ADMIN)


def normalize_email(email: str) -> str:
    """Lowercase + strip so `A@B.com ` and `a@b.com` are the same account."""
    return email.strip().lower()
