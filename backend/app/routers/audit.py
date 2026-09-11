"""Reading the admin action log.

  GET /api/audit  — newest first, filterable (admin)

Read-only by design. There is no endpoint to edit or delete an entry, and
there should never be one: a log the admin can quietly rewrite answers no
question worth asking. Entries age out only if somebody prunes the table
directly, which is a deliberate act with database access, not a button.
"""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db_session
from app.dependencies.auth import require_admin
from app.models.audit_log import AuditLog

router = APIRouter(prefix="/api/audit", tags=["audit"])

# One screenful at a time. The cap exists because this table only grows, and
# an unbounded SELECT on it is the query that eventually takes the admin
# console down.
DEFAULT_LIMIT = 100
MAX_LIMIT = 500


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


@router.get("", response_model=list[AuditRead], dependencies=[Depends(require_admin)])
async def list_audit(
    entity_type: str | None = None,
    entity_id: uuid.UUID | None = None,
    actor_id: uuid.UUID | None = None,
    action: str | None = None,
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db_session),
) -> list[AuditLog]:
    """Recent admin actions, newest first.

    `action` matches by prefix, so "order" returns every order action and
    "order.refund" narrows to refunds — one parameter instead of two.
    """
    query = select(AuditLog)
    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
    if entity_id:
        query = query.where(AuditLog.entity_id == entity_id)
    if actor_id:
        query = query.where(AuditLog.actor_id == actor_id)
    if action:
        query = query.where(AuditLog.action.startswith(action))
    query = query.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
    result = await db.execute(query.limit(limit).offset(offset))
    return list(result.scalars().all())
