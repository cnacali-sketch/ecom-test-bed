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
"""
from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.models.user import User
from app.services.request_ip import client_ip


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


async def record(
    db: AsyncSession,
    *,
    actor: User,
    action: str,
    entity_type: str,
    summary: str,
    entity_id: uuid.UUID | None = None,
    entity_label: str | None = None,
    changes: dict[str, Any] | None = None,
    request: Request | None = None,
) -> AuditLog:
    """Queue an audit entry on the caller's session. Does not commit."""
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
    )
    db.add(entry)
    return entry


def order_label(order_id: uuid.UUID) -> str:
    """How an order is named to a human: the short id the admin screens show."""
    return f"#{str(order_id)[:8]}"
