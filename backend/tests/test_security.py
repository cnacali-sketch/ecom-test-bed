"""Unit tests for password hashing and JWT helpers."""
import uuid
from datetime import timedelta

import jwt
import pytest

from app.config import get_settings
from app.services.security import (
    MAX_PASSWORD_BYTES,
    TOKEN_ACCESS,
    TOKEN_REFRESH,
    TokenError,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)


# ---- password hashing ----

def test_hash_is_not_the_plaintext():
    hashed = hash_password("hunter2-hunter2")
    assert hashed != "hunter2-hunter2"
    assert "hunter2" not in hashed


def test_verify_accepts_correct_password():
    assert verify_password("hunter2-hunter2", hash_password("hunter2-hunter2"))


def test_verify_rejects_wrong_password():
    assert not verify_password("wrong-password", hash_password("hunter2-hunter2"))


def test_same_password_hashes_differently_each_time():
    """Per-password salt: identical passwords must not share a hash."""
    assert hash_password("same-password-1") != hash_password("same-password-1")


def test_verify_returns_false_on_corrupt_hash():
    """A malformed stored hash is a failed login, not a crash."""
    assert not verify_password("any-password", "not-a-bcrypt-hash")


def test_password_over_bcrypt_limit_is_rejected():
    """bcrypt truncates at 72 bytes — reject rather than silently truncate."""
    with pytest.raises(ValueError):
        hash_password("a" * (MAX_PASSWORD_BYTES + 1))


# ---- tokens ----

def test_access_token_roundtrips():
    uid = uuid.uuid4()
    payload = decode_token(create_access_token(uid, "customer"), TOKEN_ACCESS)
    assert payload["sub"] == str(uid)
    assert payload["role"] == "customer"


def test_refresh_token_rejected_when_access_expected():
    issued = create_refresh_token(uuid.uuid4(), "customer")
    with pytest.raises(TokenError):
        decode_token(issued.token, TOKEN_ACCESS)


def test_refresh_token_carries_jti_and_family():
    """Reuse detection needs both: jti to find the row, fid to purge the family
    even when the row is already gone."""
    uid = uuid.uuid4()
    issued = create_refresh_token(uid, "customer")
    payload = decode_token(issued.token, TOKEN_REFRESH)
    assert payload["jti"] == issued.jti
    assert payload["fid"] == issued.family_id
    assert payload["sub"] == str(uid)


def test_each_refresh_token_gets_a_unique_jti():
    a = create_refresh_token(uuid.uuid4(), "customer")
    b = create_refresh_token(uuid.uuid4(), "customer")
    assert a.jti != b.jti


def test_new_login_starts_a_new_family():
    a = create_refresh_token(uuid.uuid4(), "customer")
    b = create_refresh_token(uuid.uuid4(), "customer")
    assert a.family_id != b.family_id


def test_rotation_keeps_the_family_but_changes_the_jti():
    first = create_refresh_token(uuid.uuid4(), "customer")
    rotated = create_refresh_token(uuid.uuid4(), "customer", family_id=first.family_id)
    assert rotated.family_id == first.family_id
    assert rotated.jti != first.jti


def test_access_token_rejected_when_refresh_expected():
    token = create_access_token(uuid.uuid4(), "customer")
    with pytest.raises(TokenError):
        decode_token(token, TOKEN_REFRESH)


def test_tampered_token_is_rejected():
    token = create_access_token(uuid.uuid4(), "customer")
    with pytest.raises(TokenError):
        decode_token(token + "x", TOKEN_ACCESS)


def test_token_signed_with_another_secret_is_rejected():
    forged = jwt.encode(
        {"sub": str(uuid.uuid4()), "role": "admin", "type": TOKEN_ACCESS},
        "attacker-secret",
        algorithm="HS256",
    )
    with pytest.raises(TokenError):
        decode_token(forged, TOKEN_ACCESS)


def test_alg_none_token_is_rejected():
    """An unsigned `alg: none` token must never authenticate."""
    forged = jwt.encode(
        {"sub": str(uuid.uuid4()), "role": "admin", "type": TOKEN_ACCESS},
        key="",
        algorithm="none",
    )
    with pytest.raises(TokenError):
        decode_token(forged, TOKEN_ACCESS)


def test_expired_token_is_rejected():
    settings = get_settings()
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)
    expired = jwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "role": "customer",
            "type": TOKEN_ACCESS,
            "iat": now - timedelta(hours=2),
            "exp": now - timedelta(hours=1),
        },
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    with pytest.raises(TokenError):
        decode_token(expired, TOKEN_ACCESS)
