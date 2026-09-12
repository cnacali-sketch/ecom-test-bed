"""Recording admin actions.

One rule shapes this module: **`record` adds to the session, it does not
commit.** The audit row therefore lands in the same transaction as the change
it describes. If the change rolls back — an oversell check fires, the database
rejects the write, the request dies halfway — the log entry goes with it. A
log that claims things happened which did not is worse than no log, because it
is believed.

The flip side is that a caller who forgets to commit writes nothing. That is
the safe direction of the two, and every call site here sits immediately
before an existing `await db.commit()`.

A second rule shapes the rest: **entries are chained.** Each row carries the
hash of the row before it, so an edit anywhere in the middle of the table
breaks every hash after it. Appending therefore has to read the current tip,
which means two requests appending at once could both read the same tip and
fork the chain. `pg_advisory_xact_lock` serialises that. The lock is held to
the end of the transaction, so audited admin actions queue behind each other —
free at any volume this shop will see, and the alternative is a chain that
silently forks under exactly the concurrent load that makes a log matter.
"""
from __future__ import annotations

import hashlib
import json
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from fastapi import Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.models.user import User
from app.services.request_ip import client_ip

# Any constant will do; it only has to be the same one everywhere so that all
# audit appends contend on a single lock rather than several.
CHAIN_LOCK_KEY = 8_274_531


@dataclass(frozen=True)
class SystemActor:
    """An actor that is not a person.

    A Razorpay webhook marks an order paid with nobody signed in. Attributing
    that to whichever admin last logged in would be a lie the log tells
    confidently, so automated writes get their own identity instead. Shaped to
    match the three attributes `record` reads off a `User`, and frozen because
    these are module-level constants.
    """

    email: str
    role: str = "system"
    id: uuid.UUID | None = None


#: The Razorpay webhook, which authenticates by HMAC rather than by session.
SYSTEM_RAZORPAY = SystemActor(email="razorpay@webhook")


def jsonable(value: Any) -> Any:
    """Coerce a value into something the JSON column can hold.

    Money is a Decimal, ids are UUIDs, timestamps are datetimes — none of
    which survive a JSON round-trip on their own. Decimals become strings
    rather than floats deliberately: "1499.50" as a float is a rounding bug
    waiting to be read back out of an audit trail about money.
    """
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, dict):
        return {str(k): jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [jsonable(v) for v in value]
    isoformat = getattr(value, "isoformat", None)
    if callable(isoformat):
        return isoformat()
    return str(value)


def diff(before: dict[str, Any], after: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Fields that actually moved, as ``{"field": {"from": x, "to": y}}``.

    Money is compared as a number, everything else as its stored form. Both
    halves of that matter. Decimal("0.00") and Decimal("0") are the same
    amount but serialise to different strings, so comparing them as text would
    log a refund changing from 0.00 to 0 — a change that never happened.
    Everything else is compared exactly as it will be stored, so the reverse
    cannot happen either: a `from`/`to` pair that reads identical in the log
    is never written.
    """
    changed: dict[str, dict[str, Any]] = {}
    for key in after:
        old, new = before.get(key), after[key]
        if isinstance(old, Decimal) and isinstance(new, Decimal):
            if old == new:
                continue
        elif jsonable(old) == jsonable(new):
            continue
        changed[key] = {"from": jsonable(old), "to": jsonable(new)}
    return changed


def _canonical_instant(value: datetime | None) -> str | None:
    """One spelling per instant, whatever the driver hands back.

    The same row is hashed twice in its life: once in memory on the way in,
    once after a round trip through the database on the way out. Those two
    have to agree. They do not agree by default — a timestamp written as
    tz-aware UTC comes back naive from SQLite and aware from Postgres, and
    `.isoformat()` renders those differently, so a perfectly intact row would
    fail verification on one engine and pass on the other.

    A naive value is read as UTC, which is what it is: every timestamp in this
    database is stored in UTC, and the driver simply dropped the label.
    """
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


def entry_hash(entry: AuditLog, prev_hash: str | None) -> str:
    """The tamper-evident fingerprint of one entry.

    Every stored field goes in, including the row's own id and the hash of the
    row before it. A field left out of this dict is a field an editor can
    change without breaking the chain, so the omission would quietly be the
    hole the whole mechanism exists to close.

    Serialised with sorted keys and no incidental whitespace so that the same
    entry hashes identically on the machine that wrote it and the machine that
    later verifies it.
    """
    payload = json.dumps(
        {
            "id": jsonable(entry.id),
            "actor_id": jsonable(entry.actor_id),
            "actor_email": entry.actor_email,
            "actor_role": entry.actor_role,
            "action": entry.action,
            "entity_type": entry.entity_type,
            "entity_id": jsonable(entry.entity_id),
            "entity_label": entry.entity_label,
            "summary": entry.summary,
            "changes": entry.changes,
            "ip": entry.ip,
            "created_at": _canonical_instant(entry.created_at),
            "prev_hash": prev_hash,
        },
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


async def _lock_chain(db: AsyncSession) -> None:
    """Serialise appends so two writers cannot fork the chain.

    Postgres only. SQLite — which is what the tests run on — takes a database
    level write lock of its own and has no advisory lock to take, so there is
    nothing to do and nothing to emulate.
    """
    if db.get_bind().dialect.name == "postgresql":
        await db.execute(select(func.pg_advisory_xact_lock(CHAIN_LOCK_KEY)))


async def _tip(db: AsyncSession) -> AuditLog | None:
    """The most recent entry, or None when the table is empty.

    Flushes first: a caller auditing several changes in one transaction has
    earlier entries still pending in the session, and appending to a tip that
    predates them would fork the chain inside a single request.
    """
    await db.flush()
    result = await db.execute(
        select(AuditLog).order_by(AuditLog.created_at.desc(), AuditLog.id.desc()).limit(1)
    )
    return result.scalars().first()


async def record(
    db: AsyncSession,
    *,
    actor: User | SystemActor,
    action: str,
    entity_type: str,
    summary: str,
    entity_id: uuid.UUID | None = None,
    entity_label: str | None = None,
    changes: dict[str, Any] | None = None,
    request: Request | None = None,
) -> AuditLog:
    """Queue an audit entry on the caller's session. Does not commit."""
    await _lock_chain(db)
    previous = await _tip(db)

    entry = AuditLog(
        actor_id=actor.id,
        actor_email=actor.email,
        actor_role=actor.role,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_label=entity_label[:160] if entity_label else None,
        summary=summary[:300],
        changes=jsonable(changes or {}),
        ip=(client_ip(request)[:64] or None) if request is not None else None,
        # Stamped here rather than left to the column default, because the
        # hash covers `created_at` and the default would not be applied until
        # flush — hashing a None that the stored row does not contain.
        created_at=datetime.now(timezone.utc),
        prev_id=previous.id if previous else None,
        prev_hash=previous.entry_hash if previous else None,
    )
    # The id is part of the hash, so it has to exist before hashing rather
    # than being assigned by the column default at flush time.
    entry.id = uuid.uuid4()
    entry.entry_hash = entry_hash(entry, entry.prev_hash)
    db.add(entry)
    return entry


def order_label(order_id: uuid.UUID) -> str:
    """How an order is named to a human: the short id the admin screens show."""
    return f"#{str(order_id)[:8]}"
