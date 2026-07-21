"""Authentication endpoints: register, login, refresh, logout, verify-email, me.

Tokens are delivered as httpOnly cookies, never in the response body — JS
cannot read them, so an XSS bug can't exfiltrate a session. The frontend calls
these with `credentials: "include"` and never handles a raw token.

Two properties this module exists to preserve:

  * Refresh tokens rotate and are single-use. Replaying one destroys the
    session family (services/refresh_tokens).
  * No endpoint reveals whether an email address has an account — not via
    status code, not via body, not via response time.
"""
import uuid

from fastapi import APIRouter, BackgroundTasks, Cookie, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import get_db_session
from app.dependencies.auth import ACCESS_COOKIE, REFRESH_COOKIE, require_current_user
from app.models.user import ROLE_CUSTOMER, User, normalize_email
from app.schemas.auth import (
    LoginRequest,
    MessageResponse,
    ProfileUpdate,
    RegisterRequest,
    UserRead,
)
from app.services import login_throttle, refresh_tokens
from app.services.email import send_account_exists_email, send_verification_email
from app.services.refresh_tokens import TokenReuseError
from app.services.security import (
    TOKEN_REFRESH,
    TOKEN_VERIFY,
    IssuedRefreshToken,
    TokenError,
    create_access_token,
    create_verify_token,
    decode_token,
    dummy_verify,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Same message for "no such email" and "wrong password" so the endpoint can't
# be used to enumerate which addresses have accounts.
_BAD_CREDENTIALS = HTTPException(status_code=401, detail="Incorrect email or password")
_TOO_MANY = HTTPException(status_code=429, detail="Too many attempts. Try again later.")

# Signup runs bcrypt, so an unthrottled /register is a CPU-exhaustion lever.
# Refresh is cheap but shouldn't be a free token-minting loop either.
REGISTER_MAX_PER_IP = 10
REFRESH_MAX_PER_IP = 30

# The only thing /register ever says. Identical for a new address and an
# existing one — that uniformity IS the fix, so don't branch this string.
REGISTER_ACCEPTED = "If that email address is valid, a verification link has been sent."


def _set_auth_cookies(response: Response, user: User, refresh: IssuedRefreshToken) -> None:
    settings = get_settings()
    common = {
        "httponly": True,
        "secure": settings.cookie_secure,
        "samesite": settings.cookie_samesite,
        "path": "/",
    }
    response.set_cookie(
        ACCESS_COOKIE,
        create_access_token(user.id, user.role),
        max_age=settings.jwt_access_ttl_min * 60,
        **common,
    )
    response.set_cookie(
        REFRESH_COOKIE,
        refresh.token,
        max_age=settings.jwt_refresh_ttl_days * 24 * 60 * 60,
        **common,
    )


def _clear_auth_cookies(response: Response) -> None:
    for name in (ACCESS_COOKIE, REFRESH_COOKIE):
        response.delete_cookie(name, path="/")


@router.post("/register", response_model=MessageResponse, status_code=202)
async def register(
    payload: RegisterRequest,
    request: Request,
    background: BackgroundTasks,
    db: AsyncSession = Depends(get_db_session),
) -> MessageResponse:
    """Begin registration. Always 202, never reveals whether the email exists.

    There is deliberately no 409 and no auto-login here. Returning "that email
    is taken" hands an attacker a membership oracle for any address they care
    to try; signing the caller in would trust an unproven claim to own the
    inbox. So: identical response either way, and the real outcome is delivered
    only to the address itself.
    """
    throttle_key = login_throttle.client_key(request, "register")
    if login_throttle.is_locked(throttle_key, REGISTER_MAX_PER_IP):
        raise _TOO_MANY
    login_throttle.record_failure(throttle_key)

    email = normalize_email(payload.email)

    # Hash BEFORE the existence check, unconditionally. bcrypt costs ~100ms; if
    # we only hashed for new users, an existing address would answer measurably
    # faster and response time would leak exactly what the uniform body hides.
    # The hash is simply discarded when the account already exists.
    password_hash = hash_password(payload.password)

    result = await db.execute(select(User).where(User.email == email))
    existing = result.scalar_one_or_none()

    if existing is not None:
        # Silent: no new row, no error to the caller. The inbox owner — and
        # only the inbox owner — learns an account already exists.
        background.add_task(send_account_exists_email, email)
        return MessageResponse(detail=REGISTER_ACCEPTED)

    user = User(email=email, password_hash=password_hash, role=ROLE_CUSTOMER)
    db.add(user)
    try:
        await db.commit()
    except IntegrityError:
        # Lost a race against a concurrent signup for the same address. Same
        # answer as the branch above — a 409 here would reopen the oracle under
        # concurrency.
        await db.rollback()
        background.add_task(send_account_exists_email, email)
        return MessageResponse(detail=REGISTER_ACCEPTED)

    await db.refresh(user)
    background.add_task(send_verification_email, email, create_verify_token(user.id, email))
    return MessageResponse(detail=REGISTER_ACCEPTED)


@router.post("/verify-email", response_model=UserRead)
async def verify_email(
    token: str,
    db: AsyncSession = Depends(get_db_session),
) -> User:
    """Consume a verification token and mark the address confirmed.

    Does not sign the user in — proving you own an inbox is not proving you
    know the password.
    """
    try:
        payload = decode_token(token, TOKEN_VERIFY)
    except TokenError:
        raise HTTPException(status_code=400, detail="This link is invalid or has expired")

    try:
        user_id = uuid.UUID(payload["sub"])
    except (ValueError, KeyError):
        raise HTTPException(status_code=400, detail="This link is invalid or has expired")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None or user.email != payload.get("email"):
        # Email mismatch means the address changed after the link was sent.
        raise HTTPException(status_code=400, detail="This link is invalid or has expired")

    user.is_verified = True
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/login", response_model=UserRead)
async def login(
    payload: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db_session),
) -> User:
    """Verify credentials, open a new token family, and set auth cookies."""
    email = normalize_email(payload.email)

    if login_throttle.is_locked(email):
        raise HTTPException(status_code=429, detail="Too many login attempts. Try again later.")

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user is None:
        # Hash anyway: skipping it would return far faster than a wrong-password
        # attempt and turn response time into an account-existence oracle.
        dummy_verify(payload.password)
        login_throttle.record_failure(email)
        raise _BAD_CREDENTIALS

    if not verify_password(payload.password, user.password_hash):
        login_throttle.record_failure(email)
        raise _BAD_CREDENTIALS

    login_throttle.reset(email)
    # No family_id: a fresh login is a new session, independent of any other
    # device. Revoking one must not touch the others.
    issued = await refresh_tokens.issue(db, user.id, user.role)
    await db.commit()

    _set_auth_cookies(response, user, issued)
    return user


@router.post("/refresh", response_model=UserRead)
async def refresh(
    request: Request,
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias=REFRESH_COOKIE),
    db: AsyncSession = Depends(get_db_session),
) -> User:
    """Rotate the refresh token. Replaying a spent token kills the session.

    401 = this token is not usable (absent, malformed, expired).
    403 = this token was already spent, or its family is gone. That is a breach
          signal, and the whole family has just been destroyed.
    """
    throttle_key = login_throttle.client_key(request, "refresh")
    if login_throttle.is_locked(throttle_key, REFRESH_MAX_PER_IP):
        raise _TOO_MANY
    login_throttle.record_failure(throttle_key)

    if not refresh_token:
        raise _BAD_CREDENTIALS

    try:
        payload = decode_token(refresh_token, TOKEN_REFRESH)
    except TokenError:
        # Bad signature or expired. Nothing to purge: an unsigned token proves
        # no family, and acting on its `fid` claim would let anyone delete
        # anyone's session by guessing one.
        raise _BAD_CREDENTIALS

    jti, family_id = payload.get("jti"), payload.get("fid")
    if not jti or not family_id:
        # Pre-rotation token from an older deploy. Signed, so not an attack —
        # but it has no DB row and can't be rotated. Force a fresh login.
        _clear_auth_cookies(response)
        raise _BAD_CREDENTIALS

    try:
        user_id = uuid.UUID(payload["sub"])
    except (ValueError, KeyError):
        raise _BAD_CREDENTIALS

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        await refresh_tokens.revoke_family(db, family_id)
        await db.commit()
        raise _BAD_CREDENTIALS

    try:
        # Role comes from the DB row, not the token claims, so a demoted admin
        # cannot refresh their way back into admin.
        issued = await refresh_tokens.rotate(db, jti, family_id, user.id, user.role)
    except TokenReuseError:
        _clear_auth_cookies(response)
        raise HTTPException(
            status_code=403,
            detail="This session has been revoked. Please sign in again.",
        )

    await db.commit()
    _set_auth_cookies(response, user, issued)
    return user


@router.post("/logout", status_code=204)
async def logout(
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias=REFRESH_COOKIE),
    db: AsyncSession = Depends(get_db_session),
) -> None:
    """Purge this session's token family and clear the cookies.

    Cookies alone were never enough: clearing them only asks the browser to
    forget the token, while any copy of it stayed valid until expiry. Deleting
    the family is what actually ends the session server-side.

    Always 204 — logging out twice, or with a junk cookie, is not an error.
    """
    _clear_auth_cookies(response)

    if not refresh_token:
        return

    try:
        payload = decode_token(refresh_token, TOKEN_REFRESH)
    except TokenError:
        # Unverifiable token: cookies are cleared, but we won't delete a family
        # named by an unsigned claim.
        return

    family_id = payload.get("fid")
    if family_id:
        await refresh_tokens.revoke_family(db, family_id)
        await db.commit()


@router.get("/me", response_model=UserRead)
async def me(user: User = Depends(require_current_user)) -> User:
    """Return the signed-in account — drives frontend auth state."""
    return user


@router.patch("/me", response_model=UserRead)
async def update_profile(
    payload: ProfileUpdate,
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> User:
    """Customer edits their own profile (name, phone, addresses). Only the
    fields present in the request are applied, so the form can PATCH partials.
    Persists immediately and returns the updated account."""
    data = payload.model_dump(exclude_unset=True)
    if "full_name" in data:
        user.full_name = data["full_name"]
    if "phone" in data:
        user.phone = data["phone"]
    if "postal_address" in data:
        user.postal_address = data["postal_address"] or {}
    if "billing_same" in data:
        user.billing_same = bool(data["billing_same"])
    # When billing mirrors postal, keep billing empty to avoid a stale copy.
    if user.billing_same:
        user.billing_address = {}
    elif "billing_address" in data:
        user.billing_address = data["billing_address"] or {}
    await db.commit()
    await db.refresh(user)
    return user
