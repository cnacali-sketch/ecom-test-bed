"""Admin error-log viewer — surfaces what the ErrorLoggingMiddleware
captured (500s and 401/403 denials) so an admin can see what's actually
failing without SSH access to raw container logs.

  GET    /api/error-logs        — most recent entries (admin)
  DELETE /api/error-logs        — clear the log (admin)
"""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db_session
from app.dependencies.auth import require_admin
from app.models.error_log import ErrorLog
from app.models.user import User
from app.services import audit

router = APIRouter(prefix="/api/error-logs", tags=["error-logs"], dependencies=[Depends(require_admin)])


class ErrorLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    status_code: int
    method: str
    path: str
    message: str
    detail: str | None
    created_at: datetime


@router.get("", response_model=list[ErrorLogRead])
async def list_error_logs(db: AsyncSession = Depends(get_db_session)) -> list[ErrorLog]:
    result = await db.execute(select(ErrorLog).order_by(ErrorLog.created_at.desc()).limit(200))
    return list(result.scalars().all())


@router.delete("", status_code=204)
async def clear_error_logs(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    actor: User = Depends(require_admin),
) -> None:
    """Clear the captured errors.

    Audited, and the count is recorded before the delete. Purging the record of
    what went wrong is itself an administrative act, and it is the one action
    on this screen that destroys evidence — so it leaves its own.
    """
    purged = await db.scalar(select(func.count()).select_from(ErrorLog))
    await audit.record(
        db,
        actor=actor,
        request=request,
        action="error_log.purge",
        entity_type="error_log",
        summary=f"Cleared {purged} captured error{'' if purged == 1 else 's'}",
        changes={"count": {"from": purged, "to": 0}},
    )
    await db.execute(delete(ErrorLog))
    await db.commit()
