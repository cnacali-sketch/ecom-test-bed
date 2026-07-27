"""ContactMessage ORM model — submissions from the public /contact form
(query, grievance, complaint, or business inquiry), read by admins in the
Messages screen.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base

CONTACT_CATEGORIES = {"query", "grievance", "complaint", "business_inquiry"}


class ContactMessage(Base):
    __tablename__ = "contact_messages"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    category: Mapped[str] = mapped_column(String(32))
    name: Mapped[str] = mapped_column(String(120))
    # At least one of email/phone is required (enforced in the request
    # schema, not here) — a grievance needs some way to respond.
    email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    message: Mapped[str] = mapped_column(String(2000))
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
