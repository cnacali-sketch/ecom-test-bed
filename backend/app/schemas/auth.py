"""Request/response schemas for the auth router.

UserRead deliberately omits password_hash — response models are the last line
of defence against leaking credentials.
"""
import uuid

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.services import contact_validation
from app.services.pincode import is_well_formed

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


class ForgotPasswordRequest(BaseModel):
    email: EmailStr = Field(..., max_length=EMAIL_MAX)


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=PASSWORD_MIN)

    _validate_password = field_validator("new_password")(_check_password_bytes)


# Format checks for address fields. These are deliberately FORMAT-ONLY and an
# empty value always passes: `Address` is documented as all-optional so a
# half-filled form still saves, and partial PATCH is the contract for
# /api/auth/me and /api/customers/{id}. Presence is required only where a
# complete address is actually needed -- at order creation -- so that
# optionality and validity stay separate concerns.
#
# Tightening these into required fields breaks that contract and eight tests
# that post partial addresses on purpose.
def _check_postcode_format(value: str) -> str:
    if not value:
        return value
    if not is_well_formed(value.strip()):
        # Six digits, first digit 1-8 -- measured across all 19,238 real Indian
        # postcodes, where 0 and 9 never occur as the leading digit. A
        # length-only check passes "000000" and "999999".
        raise ValueError("Enter a valid 6-digit Indian PIN code.")
    return value.strip()


def _check_phone_format(value: str) -> str:
    if not value:
        return value
    problem = contact_validation.check_phone(value)
    if problem:
        raise ValueError(problem)
    return value.strip()


class Address(BaseModel):
    """A postal or billing address. Every field optional so a half-filled form
    still saves; widths guard against oversized input."""

    # Who the courier hands the parcel to. Every Indian courier (Delhivery,
    # Shiprocket, Bluedart) requires a consignee name on the waybill, and
    # without it the admin's "deliver to" block was a street address with
    # nobody's name on it. Optional like every other field so a half-filled
    # form still saves.
    full_name: str = Field(default="", max_length=120)
    line1: str = Field(default="", max_length=200)
    line2: str = Field(default="", max_length=200)
    city: str = Field(default="", max_length=100)
    state: str = Field(default="", max_length=100)
    postcode: str = Field(default="", max_length=20)
    country: str = Field(default="", max_length=100)
    # Couriers call the recipient before a delivery attempt, so this rides with
    # the address rather than the account — a gift order ships to someone whose
    # number isn't the buyer's.
    phone: str = Field(default="", max_length=20)

    _validate_postcode = field_validator("postcode")(_check_postcode_format)
    _validate_phone = field_validator("phone")(_check_phone_format)


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    role: str
    is_verified: bool
    full_name: str | None = None
    phone: str | None = None
    postal_address: dict = Field(default_factory=dict)
    billing_address: dict = Field(default_factory=dict)
    billing_same: bool = True


class ProfileUpdate(BaseModel):
    """Customer self-edit. All optional — only the sent fields are applied."""

    full_name: str | None = Field(default=None, max_length=120)
    phone: str | None = Field(default=None, max_length=32)
    postal_address: Address | None = None
    billing_address: Address | None = None
    billing_same: bool | None = None


class MessageResponse(BaseModel):
    """A bare human-readable result.

    /register returns this and nothing else: any field that varied with whether
    the account existed would be the enumeration oracle wearing a new hat.
    """

    detail: str
