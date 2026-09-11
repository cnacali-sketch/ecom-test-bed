"""Customer directory — admin read, edit, blacklist, and delete of registered
accounts.

Reuses the existing `users` table (customers and admins share it, split by
role). Accounts are created through the storefront register flow; this
router lets an admin correct a profile, block/unblock an account (stops
login and checkout without deleting it), or delete it outright. Never
exposes the password hash or any auth state beyond `is_verified`.
"""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db_session
from app.dependencies.auth import require_admin
from app.models.user import ROLE_ADMIN, User
from app.schemas.auth import Address, UserRead
from app.services import audit, refresh_tokens

router = APIRouter(prefix="/api/customers", tags=["customers"])


class CustomerRead(UserRead):
    """The admin directory view of an account — everything UserRead exposes,
    plus when the account was created and its blacklist state. Extending
    rather than redeclaring the field list keeps the two in sync: a new
    profile field added to UserRead shows up here automatically instead of
    needing the same edit twice."""

    created_at: datetime
    is_blocked: bool
    blocked_reason: str | None = None


class CustomerEdit(BaseModel):
    """Admin edit of a customer's profile. All optional — only sent fields
    change. Role is deliberately not editable here: promoting/demoting admin
    access is high-stakes enough to warrant its own explicit action, not a
    field buried in a profile form."""

    full_name: str | None = None
    phone: str | None = None
    postal_address: Address | None = None
    billing_address: Address | None = None
    billing_same: bool | None = None


class BlockRequest(BaseModel):
    blocked: bool
    reason: str | None = None


def _profile_state(customer: User) -> dict:
    """The editable profile fields, for before/after comparison."""
    return {
        "full_name": customer.full_name,
        "phone": customer.phone,
        "postal_address": customer.postal_address,
        "billing_address": customer.billing_address,
        "billing_same": customer.billing_same,
    }


async def _get_customer_or_404(db: AsyncSession, customer_id: uuid.UUID) -> User:
    result = await db.execute(select(User).where(User.id == customer_id))
    customer = result.scalar_one_or_none()
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


@router.get("", response_model=list[CustomerRead], dependencies=[Depends(require_admin)])
async def list_customers(db: AsyncSession = Depends(get_db_session)) -> list[User]:
    """Every registered account, newest first. Admin-gated."""
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return list(result.scalars().all())


@router.patch("/{customer_id}", response_model=CustomerRead)
async def update_customer(
    customer_id: uuid.UUID,
    payload: CustomerEdit,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    actor: User = Depends(require_admin),
) -> User:
    """Correct a customer's profile (name/phone/address). Admin-gated."""
    customer = await _get_customer_or_404(db, customer_id)
    before = _profile_state(customer)
    if payload.full_name is not None:
        customer.full_name = payload.full_name
    if payload.phone is not None:
        customer.phone = payload.phone
    if payload.postal_address is not None:
        customer.postal_address = payload.postal_address.model_dump()
    if payload.billing_address is not None:
        customer.billing_address = payload.billing_address.model_dump()
    if payload.billing_same is not None:
        customer.billing_same = payload.billing_same
    await audit.record(
        db,
        actor=actor,
        request=request,
        action="customer.update",
        entity_type="customer",
        entity_id=customer.id,
        entity_label=customer.email,
        summary=f"Edited the profile of {customer.email}",
        changes=audit.diff(before, _profile_state(customer)),
    )
    await db.commit()
    await db.refresh(customer)
    return customer


@router.patch("/{customer_id}/block", response_model=CustomerRead)
async def block_customer(
    customer_id: uuid.UUID,
    payload: BlockRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    actor: User = Depends(require_admin),
) -> User:
    """Blacklist or unblock a customer. A blocked account can't log in
    (auth.login checks is_blocked) or check out signed-in (orders.create_order
    checks it too); blocking also revokes every existing session so it takes
    effect immediately instead of waiting for their access token to expire.

    Admins can't be blocked here — demote to customer first if that's really
    the intent, so a compromised admin session can't be used to silently
    disable the account that would catch it."""
    customer = await _get_customer_or_404(db, customer_id)
    if customer.role == ROLE_ADMIN:
        raise HTTPException(status_code=422, detail="Cannot block an admin account")
    was = {"is_blocked": customer.is_blocked, "blocked_reason": customer.blocked_reason}
    customer.is_blocked = payload.blocked
    customer.blocked_reason = payload.reason if payload.blocked else None
    if payload.blocked:
        await refresh_tokens.revoke_all_for_user(db, customer.id)
    await audit.record(
        db,
        actor=actor,
        request=request,
        action="customer.block" if payload.blocked else "customer.unblock",
        entity_type="customer",
        entity_id=customer.id,
        entity_label=customer.email,
        summary=(
            f"Blocked {customer.email}" + (f": {payload.reason}" if payload.reason else "")
            if payload.blocked
            else f"Unblocked {customer.email}"
        ),
        changes=audit.diff(
            was,
            {"is_blocked": customer.is_blocked, "blocked_reason": customer.blocked_reason},
        ),
    )
    await db.commit()
    await db.refresh(customer)
    return customer


@router.delete("/{customer_id}", status_code=204)
async def delete_customer(
    customer_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_admin),
) -> None:
    """Delete a customer account. Admin-gated. Past orders keep their own
    snapshotted user_id/shipping address (orders.user_id isn't a foreign key),
    so deleting the account doesn't touch order history — only the login
    itself goes away. Refusing on admin accounts and self-deletion prevents
    the two ways this endpoint could lock every admin out of the console."""
    if customer_id == current_user.id:
        raise HTTPException(status_code=422, detail="Cannot delete your own account")
    customer = await _get_customer_or_404(db, customer_id)
    if customer.role == ROLE_ADMIN:
        raise HTTPException(status_code=422, detail="Cannot delete an admin account")
    await audit.record(
        db,
        actor=current_user,
        request=request,
        action="customer.delete",
        entity_type="customer",
        entity_id=customer.id,
        entity_label=customer.email,
        summary=f"Deleted the account {customer.email}",
        changes={
            "email": {"from": customer.email, "to": None},
            "full_name": {"from": customer.full_name, "to": None},
        },
    )
    await db.delete(customer)
    await db.commit()
