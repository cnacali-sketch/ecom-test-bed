"""Format rules for the things a courier and an inbox actually need.

Before this, `POST /api/orders` accepted an email of `@`, a phone of
`0000000000` and a postcode of `x`, because the frontend checked
`email.includes("@")` and the backend checked nothing whatsoever.

Two kinds of answer, deliberately not mixed:

- **`check_*` returns a reason to refuse.** Only for things that are provably
  wrong -- a phone that is not a phone, an email that cannot receive mail.
- **`suspicions` returns things worth a human glance.** A disposable inbox or a
  street line of keyboard mash is not proof of anything, and an order is worth
  more than a guess. These append to the order's existing `flag_reason`.

Everything here is deliberately generous. A false rejection costs a real sale
and the customer never tells you it happened; a false flag costs somebody ten
seconds in the admin.
"""
from __future__ import annotations

import re

# Pragmatic, not RFC 5322. The full grammar admits addresses no real shop will
# ever be sent, and writing it out invites mistakes in the direction that
# matters: rejecting a real one. Requires a dot-separated domain and a TLD of at
# least two letters, which is what "can this receive mail" comes down to here.
_EMAIL_RE = re.compile(
    r"^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+"
    r"(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*"
    r"@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+"
    r"[A-Za-z]{2,}$"
)

EMAIL_MAX = 320

#: Inboxes that exist to be thrown away. Not refused -- plenty of people use one
#: for a first order and still want the parcel -- but worth knowing about when a
#: chargeback arrives.
_DISPOSABLE_DOMAINS = frozenset({
    "mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com",
    "temp-mail.org", "throwawaymail.com", "yopmail.com", "trashmail.com",
    "sharklasers.com", "getnada.com", "dispostable.com", "maildrop.cc",
    "fakeinbox.com", "mailnesia.com", "spamgourmet.com", "mintemail.com",
})

#: Near-misses for the domains most of this shop's customers actually use. Used
#: only to suggest a correction -- never to refuse, because `gmial.com` is a
#: real domain somebody could in principle be at.
_DOMAIN_SUGGESTIONS = {
    "gmial.com": "gmail.com", "gmai.com": "gmail.com", "gmail.co": "gmail.com",
    "gmail.con": "gmail.com", "gmaill.com": "gmail.com", "gnail.com": "gmail.com",
    "yahooo.com": "yahoo.com", "yaho.com": "yahoo.com",
    "hotmial.com": "hotmail.com", "hotmail.co": "hotmail.com",
    "outlok.com": "outlook.com", "rediffmial.com": "rediffmail.com",
}


def normalise_phone(value: str) -> str:
    """An Indian mobile reduced to its ten digits, or "" if it is not one.

    Accepts the ways people actually type it: `+91 98765 43210`,
    `098765-43210`, `0091...`. The country code and a trunk `0` are stripped
    because they carry no information here -- this shop ships only within India.
    """
    digits = re.sub(r"\D", "", value or "")
    for prefix in ("0091", "91", "0"):
        if len(digits) > 10 and digits.startswith(prefix):
            digits = digits[len(prefix):]
            break
    return digits if len(digits) == 10 else ""


def _is_patterned(digits: str) -> bool:
    """`0000000000`, `1234567890`, `9876543210` -- filler, not phone numbers."""
    if len(set(digits)) == 1:
        return True
    ascending = all(int(b) - int(a) == 1 for a, b in zip(digits, digits[1:]))
    descending = all(int(a) - int(b) == 1 for a, b in zip(digits, digits[1:]))
    return ascending or descending


def check_phone(value: str) -> str | None:
    """Reason to refuse this phone number, or None.

    A landline written with its STD code (`011-23456789`) is refused, and that
    is a decision rather than an oversight: this number exists so a courier can
    ring before attempting delivery, and every Indian courier expects a mobile.
    The message says "mobile" for exactly that reason -- told only "invalid
    phone", someone typing a working landline cannot tell what is wanted.
    """
    digits = normalise_phone(value)
    if not digits:
        return "Enter a 10-digit Indian mobile number."
    if digits[0] not in "6789":
        return "Enter a mobile number — it should start with 6, 7, 8 or 9."
    if _is_patterned(digits):
        return "That doesn't look like a real mobile number."
    return None


def check_email(value: str) -> str | None:
    """Reason to refuse this email address, or None."""
    cleaned = (value or "").strip()
    if not cleaned:
        return "Enter an email address so we can send your order confirmation."
    if len(cleaned) > EMAIL_MAX:
        return "That email address is too long."
    if not _EMAIL_RE.match(cleaned):
        return "That doesn't look like a complete email address."
    return None


def suggest_email(value: str) -> str | None:
    """A corrected address to offer, when the domain looks like a typo."""
    cleaned = (value or "").strip()
    if "@" not in cleaned:
        return None
    local, _, domain = cleaned.rpartition("@")
    fixed = _DOMAIN_SUGGESTIONS.get(domain.lower())
    return f"{local}@{fixed}" if fixed else None


def check_name(value: str) -> str | None:
    """Reason to refuse a recipient name, or None.

    Only asks that it be a name-shaped thing. Indian names are short, long,
    single-word, and full of punctuation, so anything stricter than "has some
    letters in it" refuses real people.
    """
    cleaned = " ".join((value or "").strip().split())
    if len(cleaned) < 2:
        return "Enter the full name of whoever is receiving the parcel."
    if not any(ch.isalpha() for ch in cleaned):
        return "Enter the recipient's name."
    if len(set(cleaned.replace(" ", "").lower())) == 1:
        return "Enter the recipient's name."
    return None


def check_street(value: str) -> str | None:
    """Reason to refuse a street line, or None.

    Almost nothing is refused here. A house number is *not* required: "Ashiana"
    and "Near the post office" are ordinary Indian addresses, and demanding a
    digit would turn away rural and house-named deliveries outright. Those get
    flagged instead -- see `suspicions`.
    """
    cleaned = " ".join((value or "").strip().split())
    if len(cleaned) < 3:
        return "Enter the street address the parcel should go to."
    return None


_KEYBOARD_RUNS = ("qwert", "asdfg", "zxcvb", "yuiop", "hjkl", "12345")


def looks_like_gibberish(value: str) -> bool:
    """Whether a line looks typed to get past a form rather than to be read.

    Three signals, all of them weak on their own, which is why this only ever
    raises a flag: a long run of one repeated character, a keyboard row, or a
    long alphabetic word with no vowel in it.
    """
    cleaned = (value or "").strip().lower()
    if not cleaned:
        return False
    if re.search(r"(.)\1{3,}", cleaned):
        return True
    if any(run in cleaned for run in _KEYBOARD_RUNS):
        return True
    for word in re.findall(r"[a-z]+", cleaned):
        if len(word) >= 5 and not set(word) & set("aeiou"):
            return True
    return False


def suspicions(*, email: str = "", street: str = "", city: str = "") -> list[str]:
    """Things worth an admin's glance. Never a reason to refuse an order.

    Returned as short phrases that read sensibly appended to the order's
    existing `flag_reason`.
    """
    found: list[str] = []

    domain = (email or "").strip().lower().rpartition("@")[2]
    if domain and domain in _DISPOSABLE_DOMAINS:
        found.append(f"disposable email domain ({domain})")

    if street:
        if looks_like_gibberish(street):
            found.append("street address looks like keyboard input")
        elif not any(ch.isdigit() for ch in street) and len(street.split()) == 1:
            # Weak on purpose: a one-word street with no number is unusual
            # enough to mention and far too common to refuse.
            found.append("street address has no house number")

    if city and looks_like_gibberish(city):
        found.append("city looks like keyboard input")

    return found
