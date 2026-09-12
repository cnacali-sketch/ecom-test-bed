"""Reading the admin action log.

  GET /api/audit         — newest first, filterable (admin)
  GET /api/audit/verify  — is the chain intact? (admin)

Read-only by design. There is no endpoint to edit or delete an entry, and
there should never be one: a log the admin can quietly rewrite answers no
question worth asking. A database trigger refuses UPDATE and DELETE on the
table itself, so pruning now means dropping that trigger first — a deliberate
act, not a button.

`verify` exists because the trigger cannot defend against whoever is able to
drop it. Each entry hashes the entry before it, so an edit anywhere in the
table breaks every hash after it, and this endpoint says where.
"""
import uuid
from datetime import date, datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db_session
from app.dependencies.auth import require_admin
from app.models.audit_log import AuditLog
from app.routers.events import _window, _within
from app.services.audit import entry_hash

router = APIRouter(prefix="/api/audit", tags=["audit"])

# One screenful at a time. The cap exists because this table only grows, and
# an unbounded SELECT on it is the query that eventually takes the admin
# console down.
DEFAULT_LIMIT = 100
MAX_LIMIT = 500

# Verification reads whole rows and rehashes each one, so it is the most
# expensive read this table offers. Capped for the same reason the feed is:
# an admin endpoint that degrades into a full table scan is a denial of
# service with a login form in front of it.
MAX_VERIFY = 5000


class AuditRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    actor_id: uuid.UUID | None
    actor_email: str
    actor_role: str
    action: str
    entity_type: str
    entity_id: uuid.UUID | None
    entity_label: str | None
    summary: str
    changes: dict
    ip: str | None
    created_at: datetime


class ChainStatus(BaseModel):
    """The answer to "has anybody been editing this log?"."""

    ok: bool
    checked: int
    #: The earliest entry whose hash does not match. Null when `ok`.
    first_broken_id: uuid.UUID | None = None
    #: Entries written before hashing existed. Reported separately rather than
    #: counted as broken: "we cannot prove this row is untouched" and "this row
    #: has been altered" are different statements and must not be conflated.
    unverifiable: int = 0
    detail: str


@router.get("", response_model=list[AuditRead], dependencies=[Depends(require_admin)])
async def list_audit(
    entity_type: str | None = None,
    entity_id: uuid.UUID | None = None,
    actor_id: uuid.UUID | None = None,
    actor: str | None = None,
    action: str | None = None,
    start: date | None = None,
    end: date | None = None,
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db_session),
) -> list[AuditLog]:
    """Recent admin actions, newest first.

    `action` matches by prefix, so "order" returns every order action and
    "order.refund" narrows to refunds — one parameter instead of two.

    `actor` matches the email case-insensitively, which is what somebody
    investigating actually has to hand; `actor_id` stays for linking from a
    customer row. `start` and `end` are inclusive calendar dates.
    """
    query = select(AuditLog)
    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
    if entity_id:
        query = query.where(AuditLog.entity_id == entity_id)
    if actor_id:
        query = query.where(AuditLog.actor_id == actor_id)
    if actor:
        query = query.where(func.lower(AuditLog.actor_email).contains(actor.lower()))
    if action:
        query = query.where(AuditLog.action.startswith(action))

    start_at, end_at = _window(start, end)
    query = _within(query, AuditLog.created_at, start_at, end_at)

    query = query.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
    result = await db.execute(query.limit(limit).offset(offset))
    return list(result.scalars().all())


@router.get("/verify", response_model=ChainStatus, dependencies=[Depends(require_admin)])
async def verify_chain(db: AsyncSession = Depends(get_db_session)) -> ChainStatus:
    """Walk the chain and report the first entry that does not add up.

    Two independent checks per entry, because they catch different attacks:

    * **Rehash.** Recomputing the entry's own hash from its stored fields
      catches any edit to the entry — a summary reworded, an amount changed,
      an actor swapped.
    * **Link.** Comparing the stored `prev_hash` against the actual hash of
      the entry named by `prev_id` catches edits to the *shape* of the chain:
      a row removed from the middle, or two rows re-pointed around a deletion.

    A rehash on its own would miss a clean deletion; a link check on its own
    would miss a field edit. Both are cheap.
    """
    result = await db.execute(
        select(AuditLog).order_by(AuditLog.created_at.asc(), AuditLog.id.asc()).limit(MAX_VERIFY)
    )
    entries = list(result.scalars().all())
    by_id = {entry.id: entry for entry in entries}

    unverifiable = 0
    for entry in entries:
        if not entry.entry_hash:
            # Written before the chain existed. Nothing to check against.
            unverifiable += 1
            continue

        if entry_hash(entry, entry.prev_hash) != entry.entry_hash:
            return ChainStatus(
                ok=False,
                checked=len(entries),
                first_broken_id=entry.id,
                unverifiable=unverifiable,
                detail="An entry's contents do not match its recorded hash — it has been altered.",
            )

        if entry.prev_id is not None:
            parent = by_id.get(entry.prev_id)
            if parent is None:
                # Only flag this when the parent should have been in range.
                # A window that starts mid-chain legitimately has no parent
                # loaded for its first entry.
                if len(entries) < MAX_VERIFY:
                    return ChainStatus(
                        ok=False,
                        checked=len(entries),
                        first_broken_id=entry.id,
                        unverifiable=unverifiable,
                        detail="An entry points at a predecessor that is no longer in the table.",
                    )
            elif parent.entry_hash != entry.prev_hash:
                return ChainStatus(
                    ok=False,
                    checked=len(entries),
                    first_broken_id=entry.id,
                    unverifiable=unverifiable,
                    detail="An entry's link to the one before it does not match.",
                )

    return ChainStatus(
        ok=True,
        checked=len(entries),
        unverifiable=unverifiable,
        detail=(
            f"All {len(entries) - unverifiable} hashed entries verify."
            if entries
            else "The log is empty."
        ),
    )
