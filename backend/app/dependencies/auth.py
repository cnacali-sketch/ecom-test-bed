"""Authentication dependencies.

JWT in an httpOnly cookie is the gate (P1) — it replaced the single shared
X-API-Key header, so write endpoints now know *which* user acted, not just
that someone held the key.

  require_current_user -> any logged-in account
  require_staff        -> role in {"staff", "admin"} (fulfilment endpoints)
  require_admin        -> role == "admin" (money, catalogue, customers)

Cookie-only auth is CSRF-exposed by construction: a third-party page can make
a same-"simple-request" POST/PATCH/DELETE and the browser attaches the cookie
automatically, regardless of which site the request originates from (more so
with SameSite=None, which cross-origin dev tunnels currently require — but
even SameSite=Lax only blocks *some* shapes of cross-site request). So every
state-changing request additionally has to echo back the non-httpOnly
csrf_token cookie as a header — something only same-origin JS reading
document.cookie can do. See _set_auth_cookies in routers/auth.py for where
that cookie is minted.
"""
import hmac
import uuid

from fastapi import Cookie, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db_session
from app.models.user import ROLE_ADMIN, User
from app.services.security import TOKEN_ACCESS, TokenError, decode_token

ACCESS_COOKIE = "access_token"
REFRESH_COOKIE = "refresh_token"
CSRF_COOKIE = "csrf_token"
CSRF_HEADER = "x-csrf-token"

_UNAUTHENTICATED = HTTPException(status_code=401, detail="Not authenticated")
_CSRF_INVALID = HTTPException(status_code=403, detail="Missing or invalid CSRF token")

# Methods that can change state — GET/HEAD/OPTIONS never need the CSRF check,
# both because they shouldn't have side effects and because requiring it there
# would just be extra header-plumbing for no protective benefit.
_UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


async def require_current_user(
    request: Request,
    access_token: str | None = Cookie(default=None, alias=ACCESS_COOKIE),
    csrf_token: str | None = Cookie(default=None, alias=CSRF_COOKIE),
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

    if request.method in _UNSAFE_METHODS:
        header_token = request.headers.get(CSRF_HEADER)
        if not header_token or not csrf_token or not hmac.compare_digest(header_token, csrf_token):
            raise _CSRF_INVALID

    return user


def _reject_blocked(user: User) -> None:
    """A blocked back-office account loses access immediately, not at token
    expiry.

    `is_blocked` was only ever checked at login and at checkout, which was
    enough while every blocked account was a customer: the worst it could do
    was shop. A blocked staff or admin account holding a live access token is
    a different problem entirely — blocking a compromised account would
    revoke its refresh token and leave its admin session working until the
    access token ran out. Checked here, on every back-office request.
    """
    if user.is_blocked:
        raise HTTPException(
            status_code=403,
            detail="This account has been blocked. Contact the shop owner.",
        )


async def require_staff(user: User = Depends(require_current_user)) -> User:
    """Gate the fulfilment endpoints: see orders, move them, dispatch them.

    Deliberately *not* a gate on anything that moves money or changes what the
    shop sells. Those keep require_admin, so widening this dependency by
    accident cannot quietly hand a packer the refund button.
    """
    if not user.is_staff:
        raise HTTPException(status_code=403, detail="Staff access required")
    _reject_blocked(user)
    return user


async def require_admin(user: User = Depends(require_current_user)) -> User:
    """Gate admin-only endpoints. 403 (not 401) — the caller is known, just not allowed."""
    if user.role != ROLE_ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    _reject_blocked(user)
    return user


async def optional_current_user(
    request: Request,
    access_token: str | None = Cookie(default=None, alias=ACCESS_COOKIE),
    csrf_token: str | None = Cookie(default=None, alias=CSRF_COOKIE),
    db: AsyncSession = Depends(get_db_session),
) -> User | None:
    """Same resolution as require_current_user, but returns None instead of 401.

    For endpoints that must work for both guests and signed-in accounts (guest
    checkout) while still using the real identity when one is present, rather
    than trusting whatever the client claims.

    A failed CSRF check here degrades to "treat as guest" rather than 403,
    same as an expired/invalid token does — the caller-supplied payload is
    still subject to whatever guest-path validation the endpoint already does,
    so this doesn't grant anything a real guest couldn't already do.
    """
    if not access_token:
        return None
    try:
        return await require_current_user(request, access_token, csrf_token, db)
    except HTTPException:
        return None
