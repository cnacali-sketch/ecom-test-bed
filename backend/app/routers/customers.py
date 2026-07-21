"""Customer directory — admin-only read of registered accounts.

Reuses the existing `users` table (customers and admins share it, split by
role). No write endpoints: the admin console only *views* customers here;
accounts are created through the storefront register flow. Never exposes the
password hash or any auth state beyond `is_verified`.
"""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db_session
from app.dependencies.auth import require_admin
from app.models.user import User

router = APIRouter(prefix="/api/customers", tags=["customers"])


class CustomerRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    email: str
    role: str
    is_verified: bool
    created_at: datetime
    full_name: str | None = None
    phone: str | None = None
    postal_address: dict = {}
    billing_address: dict = {}
    billing_same: bool = True


@router.get("", response_model=list[CustomerRead], dependencies=[Depends(require_admin)])
async def list_customers(db: AsyncSession = Depends(get_db_session)) -> list[User]:
    """Every registered account, newest first. Admin-gated."""
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return list(result.scalars().all())
