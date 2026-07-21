"""Refresh Token Rotation (RTR) with reuse detection.

The rule: a refresh token is spendable exactly once. Spending it mints a
replacement in the same family. Spending it twice means a copy exists that
shouldn't, so the whole family dies.

    login      -> family F, token A                 (A unused)
    refresh(A) -> A marked used, mint B in F        (B unused)
    refresh(B) -> B marked used, mint C in F        (C unused)
    refresh(A) -> A already used => BREACH          (F purged, C dies too)

That last line is the entire point. A thief who copies A and races the real
user either gets caught (victim refreshes after them) or catches themselves
(they refresh twice). Either way the session is destroyed, and the legitimate
user notices they were logged out — which is far better than a silent
30-day-replayable session.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import delete, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.refresh_token import RefreshToken
from app.services.security import IssuedRefreshToken, create_refresh_token


class TokenReuseError(Exception):
    """A refresh token was presented that was already spent, or has no record.

    Both mean the token is not the live tip of its family. The family has been
    purged by the time this is raised.
    """


async def issue(
    db: AsyncSession, user_id: uuid.UUID, role: str, family_id: str | None = None
) -> IssuedRefreshToken:
    """Mint a refresh token and record it. Omit `family_id` to start a session."""
    issued = create_refresh_token(user_id, role, family_id=family_id)
    db.add(
        RefreshToken(
            jti=issued.jti,
            family_id=issued.family_id,
            user_id=user_id,
            is_used=False,
            expires_at=issued.expires_at,
        )
    )
    await db.flush()
    return issued


async def revoke_family(db: AsyncSession, family_id: str) -> int:
    """Delete every token in a family. Returns how many rows went."""
    result = await db.execute(
        delete(RefreshToken).where(RefreshToken.family_id == family_id)
    )
    return result.rowcount or 0


async def revoke_all_for_user(db: AsyncSession, user_id: uuid.UUID) -> int:
    """Kill every session a user has. For password changes / admin lockout."""
    result = await db.execute(delete(RefreshToken).where(RefreshToken.user_id == user_id))
    return result.rowcount or 0


async def rotate(
    db: AsyncSession, jti: str, family_id: str, user_id: uuid.UUID, role: str
) -> IssuedRefreshToken:
    """Spend `jti` and mint its replacement in the same family.

    Raises TokenReuseError (after purging the family) when `jti` is already
    used or has no row at all.
    """
    # Atomic claim: the WHERE ... is_used = false means two concurrent refreshes
    # of the same token can't both win. Exactly one UPDATE matches a row; the
    # loser sees rowcount 0 and is treated as reuse. Doing this as a SELECT then
    # an UPDATE would leave a window where both requests read is_used = false.
    result = await db.execute(
        update(RefreshToken)
        .where(RefreshToken.jti == jti, RefreshToken.is_used.is_(False))
        .values(is_used=True)
    )

    if (result.rowcount or 0) == 0:
        # Either already spent (replay) or no such row (already purged/forged
        # against a dead family). Both are "not the live tip" — burn the family.
        await revoke_family(db, family_id)
        await db.commit()
        raise TokenReuseError(f"Refresh token {jti} is not live; family {family_id} purged")

    return await issue(db, user_id, role, family_id=family_id)


async def purge_expired(db: AsyncSession) -> int:
    """Drop rows past expires_at.

    Nothing calls this on a schedule yet — expired rows are inert (their JWTs
    fail signature/exp checks long before the row is consulted), they just take
    space. Wire it to a Celery beat job when the table grows.
    """
    result = await db.execute(
        delete(RefreshToken).where(RefreshToken.expires_at < datetime.now(timezone.utc))
    )
    return result.rowcount or 0
