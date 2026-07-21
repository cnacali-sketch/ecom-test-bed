"""Authentication dependencies.

JWT in an httpOnly cookie is the gate (P1) — it replaced the single shared
X-API-Key header, so write endpoints now know *which* user acted, not just
that someone held the key.

  require_current_user -> any logged-in account
  require_admin        -> role == "admin" (write endpoints, /admin)
"""
import uuid

from fastapi import Cookie, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db_session
from app.models.user import ROLE_ADMIN, User
from app.services.security import TOKEN_ACCESS, TokenError, decode_token

ACCESS_COOKIE = "access_token"
REFRESH_COOKIE = "refresh_token"

_UNAUTHENTICATED = HTTPException(status_code=401, detail="Not authenticated")


async def require_current_user(
    access_token: str | None = Cookie(default=None, alias=ACCESS_COOKIE),
    db: AsyncSession = Depends(get_db_session),
) -> User:
    """Resolve the signed-in user from the access-token cookie, or 401.

    The user is re-read from the database on every request rather than trusted
    from the token claims, so a deleted or demoted account loses access
    immediately instead of at token expiry.
    """
    if not access_token:
        raise _UNAUTHENTICATED

    try:
        payload = decode_token(access_token, TOKEN_ACCESS)
    except TokenError:
        raise _UNAUTHENTICATED

    try:
        user_id = uuid.UUID(payload["sub"])
    except (ValueError, KeyError):
        raise _UNAUTHENTICATED

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise _UNAUTHENTICATED
    return user


async def require_admin(user: User = Depends(require_current_user)) -> User:
    """Gate admin-only endpoints. 403 (not 401) — the caller is known, just not allowed."""
    if user.role != ROLE_ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


async def optional_current_user(
    access_token: str | None = Cookie(default=None, alias=ACCESS_COOKIE),
    db: AsyncSession = Depends(get_db_session),
) -> User | None:
    """Same resolution as require_current_user, but returns None instead of 401.

    For endpoints that must work for both guests and signed-in accounts (guest
    checkout) while still using the real identity when one is present, rather
    than trusting whatever the client claims.
    """
    if not access_token:
        return None
    try:
        return await require_current_user(access_token, db)
    except HTTPException:
        return None
