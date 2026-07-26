"""ErrorLog ORM model — captures server errors and auth/permission failures
so an admin can see what's actually going wrong without SSH access to the
server's raw logs.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class ErrorLog(Base):
    __tablename__ = "error_logs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    status_code: Mapped[int] = mapped_column(Integer)
    method: Mapped[str] = mapped_column(String(10))
    path: Mapped[str] = mapped_column(String(500))
    message: Mapped[str] = mapped_column(String(2000))
    # Full traceback for 500s; None for 401/403 (nothing to trace, just a
    # denial worth knowing about — e.g. the CSRF-domain bug this exists to
    # have caught immediately instead of over a support back-and-forth).
    detail: Mapped[str | None] = mapped_column(String(8000), nullable=True)
    user_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
