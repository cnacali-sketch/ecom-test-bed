"""WaitlistSignup ORM model — someone who wanted to order from outside the
delivery area.

Two jobs, and the second is the one that pays for the table:

1. **A list to notify** when the shop reaches their area.
2. **A record of demand.** Every row is somebody who filled a cart and was
   turned away, which is the only honest evidence of where to expand next.
   Counting rows by district beats guessing.

An approved row is also the exception mechanism: approving it lets that
postcode through checkout, so a "can you make an exception?" conversation ends
in a click rather than an order keyed in by hand.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base

#: Waiting to hear; the shop has said yes to this one specifically; already told.
WAITLIST_STATUSES = {"pending", "approved", "notified"}


class WaitlistSignup(Base):
    __tablename__ = "waitlist_signups"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(320))
    phone: Mapped[str] = mapped_column(String(32))
    # The postcode is the point of the record: it is what gets matched at
    # checkout when an exception is granted, and what demand is counted by.
    postcode: Mapped[str] = mapped_column(String(16), index=True)
    # Resolved at signup rather than looked up later, so the admin list reads as
    # place names without a lookup per row, and so the record still says where
    # someone was even if the postal data later changes under it.
    district: Mapped[str] = mapped_column(String(120), default="", server_default="")
    state: Mapped[str] = mapped_column(String(120), default="", server_default="")
    # String(32) not String(16): "notified" fits either, but the orders table
    # taught this codebase what a too-narrow status column costs.
    status: Mapped[str] = mapped_column(String(32), default="pending", server_default="pending")
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
