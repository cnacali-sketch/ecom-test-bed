"""Customer directory — admin-only read of registered accounts.

Reuses the existing `users` table (customers and admins share it, split by
role). No write endpoints: the admin console only *views* customers here;
accounts are created through the storefront register flow. Never exposes the
password hash or any auth state beyond `is_verified`.
"""
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db_session
from app.dependencies.auth import require_admin
from app.models.user import User
from app.schemas.auth import UserRead

router = APIRouter(prefix="/api/customers", tags=["customers"])


class CustomerRead(UserRead):
    """The admin directory view of an account — everything UserRead exposes,
    plus when the account was created. Extending rather than redeclaring the
    field list keeps the two in sync: a new profile field added to UserRead
    shows up here automatically instead of needing the same edit twice."""

    created_at: datetime


@router.get("", response_model=list[CustomerRead], dependencies=[Depends(require_admin)])
async def list_customers(db: AsyncSession = Depends(get_db_session)) -> list[User]:
    """Every registered account, newest first. Admin-gated."""
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return list(result.scalars().all())
