"""Request/response schemas for the auth router.

UserRead deliberately omits password_hash — response models are the last line
of defence against leaking credentials.
"""
import uuid

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

# bcrypt's hard limit is 72 *bytes* (see services.security.MAX_PASSWORD_BYTES).
# Validated here so an over-long password is a 422, not a 500 from hash_password.
PASSWORD_MIN = 8
PASSWORD_MAX_BYTES = 72
# Matches the users.email column width.
EMAIL_MAX = 320


def _check_password_bytes(value: str) -> str:
    # Length must be measured in bytes: "😀" is one character but four bytes,
    # so a character-count check would let a >72-byte password through to bcrypt.
    if len(value.encode("utf-8")) > PASSWORD_MAX_BYTES:
        raise ValueError(f"Password must be at most {PASSWORD_MAX_BYTES} bytes")
    return value


class RegisterRequest(BaseModel):
    email: EmailStr = Field(..., max_length=EMAIL_MAX)
    password: str = Field(..., min_length=PASSWORD_MIN)

    _validate_password = field_validator("password")(_check_password_bytes)


class LoginRequest(BaseModel):
    email: EmailStr = Field(..., max_length=EMAIL_MAX)
    password: str = Field(..., min_length=1)

    _validate_password = field_validator("password")(_check_password_bytes)


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    role: str
    is_verified: bool


class MessageResponse(BaseModel):
    """A bare human-readable result.

    /register returns this and nothing else: any field that varied with whether
    the account existed would be the enumeration oracle wearing a new hat.
    """

    detail: str
