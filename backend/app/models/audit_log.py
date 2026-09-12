"""Who changed what, when — the admin action log.

Every money-touching or destructive admin action writes a row here. The point
is not surveillance; it is that when an order is refunded twice, a customer is
deleted, or stock moves overnight, somebody has to be able to answer "who did
this and what did it look like before". Without that the only honest answer is
a shrug, and with staff accounts about to exist that answer stops being good
enough.

Three deliberate choices:

**The actor is snapshotted, not joined.** `actor_id` is a plain UUID column
with no foreign key, and the email and role are copied onto the row. Deleting
an account must not erase what that account did, and a log that says
"deleted user" where the name should be is a log nobody can act on.

**Only the diff is stored, not the whole object.** `changes` holds
``{"field": {"from": x, "to": y}}`` for the fields that actually moved. Storing
the full before/after of an order would make the table larger than the orders
table within a month, and the reader almost always wants "what changed",
not "what the row looked like".

**`summary` is written for a person.** "Marked as shipped" beats
``status: pending -> shipped`` for the shop owner scrolling this at 11pm. The
machine-readable diff is right there in `changes` when the detail is needed.

**The rows are chained.** Each entry stores the hash of the entry before it
and a hash of itself, so the table is a linked list that cannot be edited in
the middle without every later hash ceasing to match. A database trigger
already refuses UPDATE and DELETE; the chain is what catches the case the
trigger cannot — somebody with enough access to drop the trigger, change a
row, and put it back. Between them: the trigger stops the casual edit, the
chain proves whether one happened.

The link is stored as `prev_id` and not re-derived from timestamps at
verification time. Two entries written in the same transaction can share a
`created_at` to the microsecond, and sorting to rebuild the order would then
tie-break on a random UUID — producing a fork that looks exactly like
tampering. Recording which row was actually appended to removes the guess.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Index, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from sqlalchemy.types import JSON

from app.db import Base

JSONType = JSONB().with_variant(JSON(), "sqlite")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (
        # The two reads this table gets: the activity feed (newest first) and
        # "show me everything that happened to this order".
        Index("ix_audit_logs_created_at", "created_at"),
        Index("ix_audit_logs_entity", "entity_type", "entity_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)

    # ---- Who ----
    # No ForeignKey: see the module docstring. The account can go; the record
    # of what it did stays.
    actor_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True, index=True)
    actor_email: Mapped[str] = mapped_column(String(320))
    # The role held *at the time of the action*, not the role held now. A
    # staff member later promoted to admin must not retroactively look like
    # an admin on last month's entries.
    actor_role: Mapped[str] = mapped_column(String(16))

    # ---- What ----
    # Dotted and stable: "order.status", "order.refund", "customer.delete".
    # The prefix is the entity, the suffix the verb, so filtering by either
    # is a prefix match rather than a new column.
    action: Mapped[str] = mapped_column(String(64), index=True)
    entity_type: Mapped[str] = mapped_column(String(32))
    entity_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    # Something a human recognises the row by after the entity is gone — an
    # order's short id, a customer's email. A deleted entity's id alone tells
    # the reader nothing.
    entity_label: Mapped[str | None] = mapped_column(String(160), nullable=True)

    summary: Mapped[str] = mapped_column(String(300))
    changes: Mapped[dict] = mapped_column(JSONType, default=dict, server_default="{}")

    # ---- Tamper evidence ----
    # The entry this one was appended after. Null on exactly one row: the
    # first ever written. Indexed because verification walks the chain by
    # following these links.
    prev_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True, index=True)
    # SHA-256 hex, so 64 characters. `prev_hash` is null on the genesis row
    # for the same reason `prev_id` is.
    prev_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    entry_hash: Mapped[str] = mapped_column(String(64), default="")

    # ---- When and from where ----
    ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # Stamped in Python, not by the database. `now()` is the transaction
    # timestamp on Postgres and second-granular on SQLite, so every entry
    # written by one bulk action — and, under SQLite, every entry written in
    # the same second — would share a timestamp. The feed then falls back to
    # tie-breaking on a random UUID, and "newest first" silently becomes
    # "arbitrary". The server default stays as a backstop for rows inserted
    # by hand in SQL.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )
