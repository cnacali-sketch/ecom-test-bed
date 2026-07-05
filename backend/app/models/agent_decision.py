"""AgentDecision ORM model -- audit log of agent input/output pairs."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from sqlalchemy.types import JSON

from app.db import Base


class AgentDecision(Base):
    """Records what an agent decided, given a specific input, for auditing/eval."""

    __tablename__ = "agent_decisions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    agent_name: Mapped[str] = mapped_column(String(64), index=True)
    input: Mapped[dict] = mapped_column(JSON(), default=dict)
    decision: Mapped[dict] = mapped_column(JSON(), default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
