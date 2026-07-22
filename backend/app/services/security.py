"""Password hashing and JWT encode/decode.

Three token types are issued, distinguished by the `type` claim:
  - access  (short-lived, authorizes requests)
  - refresh (long-lived, only mints new access tokens; rotated on every use)
  - verify  (single-purpose, proves control of an email address)

`decode_token` requires the caller to state which type it expects, so a
refresh token can never be replayed as an access token.

Refresh tokens additionally carry:
  - `jti` — identifies this exact token, matched against refresh_tokens.jti
  - `fid` — the family (login session) it belongs to

`fid` lives in the token, not only in the database, on purpose: when a stolen
token is replayed its row may already be gone, and the family still has to be
identifiable so it can be purged. See services/refresh_tokens.rotate.
"""
from __future__ import annotations

import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.config import get_settings

TOKEN_ACCESS = "access"
TOKEN_REFRESH = "refresh"
TOKEN_VERIFY = "verify"

# bcrypt truncates silently at 72 bytes; reject longer input instead of
# letting two different passwords authenticate the same account.
MAX_PASSWORD_BYTES = 72


class TokenError(Exception):
    """Raised when a token is missing, malformed, expired, or the wrong type."""


def hash_password(password: str) -> str:
    """Hash a plaintext password with a per-password bcrypt salt."""
    encoded = password.encode("utf-8")
    if len(encoded) > MAX_PASSWORD_BYTES:
        raise ValueError(f"Password must be at most {MAX_PASSWORD_BYTES} bytes")
    return bcrypt.hashpw(encoded, bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """Return True when `password` matches `password_hash`.

    Never raises on malformed input — a corrupt hash is a failed login, not a 500.
    """
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


# A real bcrypt hash of a value nothing can match. Used to spend the same ~100ms
# on a login for an unknown email as for a known one, so response time doesn't
# reveal which addresses have accounts.
_DUMMY_HASH = bcrypt.hashpw(b"no-such-account-timing-equalizer", bcrypt.gensalt()).decode("utf-8")


def dummy_verify(password: str) -> None:
    """Burn the same work verify_password would, then discard the result."""
    verify_password(password, _DUMMY_HASH)


def _create_token(
    *,
    subject: uuid.UUID,
    role: str,
    token_type: str,
    ttl: timedelta,
    extra: dict | None = None,
) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(subject),
        "role": role,
        "type": token_type,
        "iat": now,
        "exp": now + ttl,
        **(extra or {}),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(subject: uuid.UUID, role: str) -> str:
    settings = get_settings()
    return _create_token(
        subject=subject,
        role=role,
        token_type=TOKEN_ACCESS,
        ttl=timedelta(minutes=settings.jwt_access_ttl_min),
    )


@dataclass(frozen=True)
class IssuedRefreshToken:
    """A minted refresh token plus the facts the DB row needs."""

    token: str
    jti: str
    family_id: str
    expires_at: datetime


def create_refresh_token(
    subject: uuid.UUID, role: str, family_id: str | None = None
) -> IssuedRefreshToken:
    """Mint a refresh token.

    Pass `family_id` to continue an existing login session (rotation); omit it
    to start a new one (fresh login).
    """
    settings = get_settings()
    jti = uuid.uuid4().hex
    fid = family_id or uuid.uuid4().hex
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.jwt_refresh_ttl_days)

    token = _create_token(
        subject=subject,
        role=role,
        token_type=TOKEN_REFRESH,
        ttl=timedelta(days=settings.jwt_refresh_ttl_days),
        extra={"jti": jti, "fid": fid},
    )
    return IssuedRefreshToken(token=token, jti=jti, family_id=fid, expires_at=expires_at)


def create_verify_token(subject: uuid.UUID, email: str) -> str:
    """Single-purpose token proving control of `email`. Carries no role."""
    settings = get_settings()
    return _create_token(
        subject=subject,
        role="",
        token_type=TOKEN_VERIFY,
        ttl=timedelta(hours=settings.email_verify_ttl_hours),
        extra={"email": email},
    )


def generate_csrf_token() -> str:
    """Opaque random value for the double-submit CSRF cookie/header pair.

    Not a JWT — it carries no claims and is never decoded, only compared
    byte-for-byte against the same value echoed back as a header. See
    dependencies/auth.py for where that comparison happens.
    """
    return secrets.token_urlsafe(32)


def decode_token(token: str, expected_type: str) -> dict:
    """Decode and validate a token, or raise TokenError.

    Signature, expiry, and the `type` claim are all enforced. The algorithm is
    pinned to the configured one so a token can't claim `alg: none`.
    """
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError as exc:
        raise TokenError(str(exc)) from exc

    if payload.get("type") != expected_type:
        raise TokenError(f"Expected a {expected_type} token")
    if not payload.get("sub"):
        raise TokenError("Token is missing a subject")
    return payload
