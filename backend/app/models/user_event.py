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
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
