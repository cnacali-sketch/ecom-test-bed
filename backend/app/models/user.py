"""User ORM model — customers and admins share one table, split by `role`.

Two roles exist in P1: "customer" (storefront account) and "admin" (gates
/admin and every write endpoint). `is_verified` is written by the P2 email
OTP flow; P1 creates users already-unverified and does not enforce it yet.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base

ROLE_CUSTOMER = "customer"
ROLE_ADMIN = "admin"


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

    @property
    def is_admin(self) -> bool:
        return self.role == ROLE_ADMIN


def normalize_email(email: str) -> str:
    """Lowercase + strip so `A@B.com ` and `a@b.com` are the same account."""
    return email.strip().lower()
