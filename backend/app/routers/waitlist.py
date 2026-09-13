"""Waitlist for people the shop cannot deliver to yet.

Signup is public, because the whole point is that it happens at the moment
somebody is turned away at checkout -- asking them to make an account first
would lose exactly the person this is trying to keep.

Approving an entry is the exception mechanism. It lets that one postcode
through checkout, so "can you make an exception?" ends in a click instead of an
order typed in by hand.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import require_admin
from app.db import get_db_session
from app.models.waitlist_signup import WAITLIST_STATUSES, WaitlistSignup
from app.services import contact_validation, login_throttle, pincode

router = APIRouter(prefix="/api/waitlist", tags=["waitlist"])

# Same shape as the other public write endpoints (contact, coupons): generous
# enough that a person retrying never notices, tight enough that the table
# cannot be filled by a script.
WAITLIST_MAX_PER_IP = 10
_TOO_MANY = HTTPException(
    status_code=429, detail="Too many requests from this address. Try again shortly."
)


def _validated(check, message_field: str):
    """Adapt a `check_*` function into a Pydantic validator.

    The service returns the reason as a string, which is exactly what
    `ValueError` wants, so the shopper reads the same sentence whether the
    rejection happened in the browser or here.
    """

    def validator(value: str) -> str:
        problem = check(value)
        if problem:
            raise ValueError(problem)
        return value.strip()

    validator.__name__ = f"_check_{message_field}"
    return validator


class WaitlistCreate(BaseModel):
    name: str = Field(..., max_length=120)
    email: str = Field(..., max_length=320)
    phone: str = Field(..., max_length=32)
    postcode: str = Field(..., max_length=16)

    _check_name = field_validator("name")(_validated(contact_validation.check_name, "name"))
    _check_email = field_validator("email")(_validated(contact_validation.check_email, "email"))
    _check_phone = field_validator("phone")(_validated(contact_validation.check_phone, "phone"))

    @field_validator("postcode")
    @classmethod
    def _check_postcode(cls, value: str) -> str:
        cleaned = (value or "").strip()
        if not pincode.is_well_formed(cleaned):
            raise ValueError("Enter a 6-digit PIN code.")
        return cleaned


class WaitlistRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    email: str
    phone: str
    postcode: str
    district: str
    state: str
    status: str
    note: str | None
    created_at: datetime
    approved_at: datetime | None


class WaitlistUpdate(BaseModel):
    status: str | None = None
    note: str | None = Field(default=None, max_length=500)


class AreaDemand(BaseModel):
    """How many people are waiting in one place. The reason to keep the table."""

    district: str
    state: str
    signups: int


@router.post("", response_model=WaitlistRead, status_code=201)
async def join_waitlist(
    payload: WaitlistCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> WaitlistSignup:
    """Record someone who wanted to order from outside the delivery area."""
    key = login_throttle.client_key(request, "waitlist")
    if login_throttle.is_locked(key, WAITLIST_MAX_PER_IP):
        raise _TOO_MANY
    login_throttle.record_failure(key)

    # Resolve the place now, so the admin list reads as names without a lookup
    # per row. A failure here is not the shopper's problem -- the signup is
    # worth keeping even if we cannot say where they are.
    verdict = pincode.verify(payload.postcode)
    place = verdict.place

    existing = (
        await db.execute(
            select(WaitlistSignup).where(
                func.lower(WaitlistSignup.email) == payload.email.lower(),
                WaitlistSignup.postcode == payload.postcode,
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        # Signing up twice is what a person does when they are not sure the
        # first one worked. Answer as though it did rather than erroring, and
        # never downgrade an entry that has since been approved.
        return existing

    signup = WaitlistSignup(
        name=payload.name,
        email=payload.email,
        phone=contact_validation.normalise_phone(payload.phone) or payload.phone,
        postcode=payload.postcode,
        district=place.district if place else "",
        state=place.state if place else "",
    )
    db.add(signup)
    await db.commit()
    await db.refresh(signup)
    return signup


@router.get("", response_model=list[WaitlistRead], dependencies=[Depends(require_admin)])
async def list_waitlist(
    status: str | None = None,
    db: AsyncSession = Depends(get_db_session),
) -> list[WaitlistSignup]:
    """Everyone waiting, newest first."""
    query = select(WaitlistSignup).order_by(WaitlistSignup.created_at.desc())
    if status:
        query = query.where(WaitlistSignup.status == status)
    return list((await db.execute(query)).scalars().all())


@router.get("/demand", response_model=list[AreaDemand], dependencies=[Depends(require_admin)])
async def area_demand(db: AsyncSession = Depends(get_db_session)) -> list[AreaDemand]:
    """Where the people who were turned away actually live.

    The question this whole table exists to answer: which city is worth opening
    next. Ordered by the number of people asking, because that is the answer.
    """
    rows = await db.execute(
        select(
            WaitlistSignup.district,
            WaitlistSignup.state,
            func.count(WaitlistSignup.id).label("signups"),
        )
        .group_by(WaitlistSignup.district, WaitlistSignup.state)
        .order_by(func.count(WaitlistSignup.id).desc())
    )
    return [
        AreaDemand(district=district or "Unknown", state=state or "", signups=signups)
        for district, state, signups in rows.all()
    ]


@router.patch("/{signup_id}", response_model=WaitlistRead, dependencies=[Depends(require_admin)])
async def update_waitlist_entry(
    signup_id: uuid.UUID,
    payload: WaitlistUpdate,
    db: AsyncSession = Depends(get_db_session),
) -> WaitlistSignup:
    """Approve an entry, mark it notified, or leave a note.

    Approving is what grants the exception: `is_postcode_approved` below is what
    checkout consults, so this single field is the difference between someone
    being refused and being able to complete their order.
    """
    signup = (
        await db.execute(select(WaitlistSignup).where(WaitlistSignup.id == signup_id))
    ).scalar_one_or_none()
    if signup is None:
        raise HTTPException(status_code=404, detail="Waitlist entry not found")

    if payload.status is not None:
        if payload.status not in WAITLIST_STATUSES:
            raise HTTPException(
                status_code=422, detail=f"status must be one of {sorted(WAITLIST_STATUSES)}"
            )
        signup.status = payload.status
        signup.approved_at = (
            datetime.now(timezone.utc) if payload.status == "approved" else signup.approved_at
        )

    if payload.note is not None:
        signup.note = payload.note

    await db.commit()
    await db.refresh(signup)
    return signup


async def is_postcode_approved(db: AsyncSession, postcode: str) -> bool:
    """Whether an exception has been granted for this postcode.

    Deliberately keyed on the postcode rather than the person: checkout is open
    to guests, so there is no identity to match against at the moment it
    matters. Approving an entry therefore opens that postcode, which is a
    decision worth knowing about -- it is stated in the admin next to the
    button.
    """
    if not postcode:
        return False
    found = await db.scalar(
        select(WaitlistSignup.id)
        .where(WaitlistSignup.postcode == postcode, WaitlistSignup.status == "approved")
        .limit(1)
    )
    return found is not None
