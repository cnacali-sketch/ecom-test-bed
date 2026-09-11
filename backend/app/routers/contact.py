"""Contact form endpoints.

  POST   /api/contact         — submit a query/grievance/complaint/business
                                 inquiry (public; the storefront /contact form)
  GET    /api/contact         — list every submission, newest first (admin)
  PATCH  /api/contact/{id}    — mark read/unread (admin)
  DELETE /api/contact/{id}    — remove a submission, e.g. spam (admin)
"""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db_session
from app.dependencies.auth import require_admin, require_staff
from app.models.contact_message import CONTACT_CATEGORIES, ContactMessage
from app.services import login_throttle
from app.services.request_ip import client_ip

router = APIRouter(prefix="/api/contact", tags=["contact"])

# A contact form is a lower-stakes target than login/orders, but still worth
# capping — same 5-minute window as every other login_throttle caller.
CONTACT_MAX_PER_IP = 10
_TOO_MANY = HTTPException(status_code=429, detail="Too many messages from this address. Try again shortly.")


class ContactCreate(BaseModel):
    category: str
    name: str = Field(..., min_length=1, max_length=120)
    email: str | None = Field(default=None, max_length=320)
    phone: str | None = Field(default=None, max_length=32)
    message: str = Field(..., min_length=1, max_length=2000)

    @model_validator(mode="after")
    def _require_contact_method(self) -> "ContactCreate":
        if not (self.email or "").strip() and not (self.phone or "").strip():
            raise ValueError("Provide an email or phone number so we can respond.")
        return self


class ContactRead(BaseModel):
    """Response for the public POST — the submitter's own confirmation.
    Omits `ip_address`: no reason to echo a visitor's own recorded IP back to
    them. Admin list/update views use ContactAdminRead, which adds it back."""

    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    category: str
    name: str
    email: str | None
    phone: str | None
    message: str
    is_read: bool
    created_at: datetime


class ContactAdminRead(ContactRead):
    ip_address: str | None


async def _get_message_or_404(db: AsyncSession, message_id: uuid.UUID) -> ContactMessage:
    result = await db.execute(select(ContactMessage).where(ContactMessage.id == message_id))
    message = result.scalar_one_or_none()
    if message is None:
        raise HTTPException(status_code=404, detail="Message not found")
    return message


@router.post("", response_model=ContactRead, status_code=201)
async def create_contact_message(
    payload: ContactCreate, request: Request, db: AsyncSession = Depends(get_db_session)
) -> ContactMessage:
    if payload.category not in CONTACT_CATEGORIES:
        raise HTTPException(status_code=422, detail=f"category must be one of {sorted(CONTACT_CATEGORIES)}")

    throttle_key = login_throttle.client_key(request, "contact")
    if login_throttle.is_locked(throttle_key, CONTACT_MAX_PER_IP):
        raise _TOO_MANY
    login_throttle.record_failure(throttle_key)

    message = ContactMessage(
        category=payload.category,
        name=payload.name.strip(),
        email=(payload.email or "").strip() or None,
        phone=(payload.phone or "").strip() or None,
        message=payload.message.strip(),
        ip_address=client_ip(request)[:64] or None,
    )
    db.add(message)
    await db.commit()
    await db.refresh(message)
    return message


@router.get("", response_model=list[ContactAdminRead], dependencies=[Depends(require_staff)])
async def list_contact_messages(db: AsyncSession = Depends(get_db_session)) -> list[ContactMessage]:
    result = await db.execute(select(ContactMessage).order_by(ContactMessage.created_at.desc()))
    return list(result.scalars().all())


# Marking a message handled is the support job itself. Deleting one stays
# admin-only — that is the customer's complaint disappearing.
@router.patch("/{message_id}", response_model=ContactAdminRead, dependencies=[Depends(require_staff)])
async def update_contact_message(
    message_id: uuid.UUID, is_read: bool, db: AsyncSession = Depends(get_db_session)
) -> ContactMessage:
    message = await _get_message_or_404(db, message_id)
    message.is_read = is_read
    await db.commit()
    await db.refresh(message)
    return message


@router.delete("/{message_id}", status_code=204, dependencies=[Depends(require_admin)])
async def delete_contact_message(message_id: uuid.UUID, db: AsyncSession = Depends(get_db_session)) -> None:
    message = await _get_message_or_404(db, message_id)
    await db.delete(message)
    await db.commit()
