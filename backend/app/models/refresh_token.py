"""Refresh token records — the server-side half of Refresh Token Rotation.

Every refresh token issued gets a row. The row is not itself a credential:
holding a `jti` proves nothing, because the client must still present the
signed JWT that carries it. The row exists so the server can answer two
questions a stateless JWT cannot:

  1. Has this exact token already been spent? (`is_used`)
  2. Should this whole session be killed right now? (delete by `family_id`)

A `family_id` is one login session. Each rotation mints a new token in the
same family. Presenting an already-used token means a copy leaked, so the
entire family is destroyed — the thief and the victim both get logged out,
which is the point.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class RefreshToken(Base):
    """One issued refresh token. Rotated on every use."""

    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    # JWT `jti` claim — identifies this exact token.
    jti: Mapped[str] = mapped_column(String(36), unique=True, index=True)
    # JWT `fid` claim — the login session this token belongs to. Indexed
    # because reuse detection deletes by family, on the hot path.
    family_id: Mapped[str] = mapped_column(String(36), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    # Flipped by an atomic UPDATE ... WHERE is_used = false, so two concurrent
    # refreshes can't both rotate the same token.
    is_used: Mapped[bool] = mapped_column(Boolean, default=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
