"""InventorySnapshot ORM model -- point-in-time stock level for the inventory agent feedback loop."""
from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class InventorySnapshot(Base):
    """A point-in-time quantity reading for a product, used to detect demand trends."""

    __tablename__ = "inventory_snapshots"
    __table_args__ = (
        # One reading per product per day, enforced by the database rather than
        # by whoever calls the job.
        #
        # The alternative was a lock around the capture. A lock only holds while
        # the thing holding it is the only writer, and this job is deliberately
        # easy to run by hand as well as on its timer -- and the API server runs
        # as a single uvicorn process today purely because nobody has added
        # `--workers 2` yet. Adding one later would silently double every
        # reading, and a stock history with two different numbers for the same
        # day is worse than none, because a later trend line would average them
        # and look plausible.
        UniqueConstraint("product_id", "snapshot_date", name="uq_inventory_snapshots_product_day"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    product_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("products.id"), index=True)
    quantity: Mapped[int] = mapped_column(Integer())
    snapshot_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # The day this reading belongs to, as a plain date.
    #
    # Deriving it from `snapshot_at` would have meant a functional unique index
    # over a cast, spelled differently on PostgreSQL (`snapshot_at::date`) and
    # SQLite (`date(snapshot_at)`) -- two expressions to keep in step, and the
    # tests run on the engine that would not have caught the drift.
    snapshot_date: Mapped[date] = mapped_column(Date(), index=True)
