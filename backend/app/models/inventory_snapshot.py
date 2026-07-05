"""InventorySnapshot ORM model -- point-in-time stock level for the inventory agent feedback loop."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class InventorySnapshot(Base):
    """A point-in-time quantity reading for a product, used to detect demand trends."""

    __tablename__ = "inventory_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    product_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("products.id"), index=True)
    quantity: Mapped[int] = mapped_column(Integer())
    snapshot_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
