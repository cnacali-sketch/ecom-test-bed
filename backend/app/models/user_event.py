"""UserEvent ORM model -- tracks browse/click/purchase/review events."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Index, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from sqlalchemy.types import JSON

from app.db import Base


class UserEvent(Base):
    """A single user interaction event (browse, click, purchase, review, ...).

    Indexed on (user_id, created_at) to support the agent feedback-loop
    queries described in the architecture doc (e.g. "recent events for
    this user").
    """

    __tablename__ = "user_events"
    __table_args__ = (
        Index("ix_user_events_user_id_created_at", "user_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[str] = mapped_column(String(64))
    event_type: Mapped[str] = mapped_column(String(32))
    payload: Mapped[dict] = mapped_column(JSON(), default=dict)
    # HMAC of the client IP (never the raw address — see events.py _hash_ip)
    # and the request's User-Agent. Both feed the admin fraud/abuse summary
    # (ad-click velocity, checkout/coupon abuse) — never used to auto-block.
    ip_hash: Mapped[str | None] = mapped_column(String(32), nullable=True)
    # Raw IP, kept alongside the hash so a fraud pattern is actually
    # actionable (block at the firewall) rather than only groupable.
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(256), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
