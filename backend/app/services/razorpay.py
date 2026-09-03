"""Razorpay payment integration (server-side).

The Key Secret is read from config and never exposed to the browser. We only
ever do two things:
  1. ``create_razorpay_order`` — ask Razorpay for a payment-order id for a
     given total (paise), which the checkout then opens in the Razorpay SDK.
  2. ``verify_payment_signature`` — confirm a payment was genuinely captured
     (HMAC-SHA256 over ``order_id|payment_id``) before an order is marked paid.

No money moves without a verified signature. The frontend never tells us an
order is paid — the signature is the proof.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import urllib.error
import urllib.request
from decimal import Decimal

from app.config import get_settings

RAZORPAY_BASE = "https://api.razorpay.com/v1"
CURRENCY = "INR"


def razorpay_enabled() -> bool:
    settings = get_settings()
    return bool(settings.razorpay_key_id and settings.razorpay_key_secret)


def _basic_auth() -> str:
    settings = get_settings()
    raw = f"{settings.razorpay_key_id}:{settings.razorpay_key_secret}"
    return "Basic " + base64.b64encode(raw.encode("utf-8")).decode("ascii")


def create_razorpay_order(
    total: Decimal, receipt: str, extra_notes: dict | None = None
) -> dict:
    """Create a Razorpay order for ``total`` (INR, paise = total*100).

    Returns ``{"id", "amount", "currency"}``. Raises RuntimeError on failure so
    the caller returns a clean 502 instead of crashing.
    """
    if not razorpay_enabled():
        raise RuntimeError("Razorpay is not configured on this server")

    amount_paise = int((total * 100).to_integral_value())
    if amount_paise <= 0:
        raise RuntimeError("Cannot create a Razorpay order for a zero total")

    notes = {"source": "savvy-in-teal-storefront"}
    if extra_notes:
        notes.update(extra_notes)

    payload = json.dumps(
        {
            "amount": amount_paise,
            "currency": CURRENCY,
            "receipt": receipt,
            "notes": notes,
        }
    ).encode("utf-8")

    request = urllib.request.Request(
        RAZORPAY_BASE + "/orders",
        data=payload,
        method="POST",
        headers={"Content-Type": "application/json", "Authorization": _basic_auth()},
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", "replace")[:300]
        raise RuntimeError(f"Razorpay order creation failed: {error.code} {detail}") from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"Could not reach Razorpay: {error.reason}") from error

    return {
        "id": data["id"],
        "amount": data["amount"],  # paise, echoed back so the client can't lie
        "currency": data["currency"],
    }


def verify_payment_signature(order_id: str, payment_id: str, signature: str) -> bool:
    """Verify a Razorpay signature over ``order_id|payment_id``.

    The signature is the HMAC-SHA256 of ``"<order_id>|<payment_id>"`` using the
    Key Secret as the key, hex-encoded. Compared in constant time.
    """
    if not razorpay_enabled():
        return False
    expected = hmac.new(
        get_settings().razorpay_key_secret.encode("utf-8"),
        msg=f"{order_id}|{payment_id}".encode("utf-8"),
        digestmod=hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


def verify_webhook_signature(raw_body: bytes, signature: str) -> bool:
    """Verify a Razorpay webhook's ``X-Razorpay-Signature`` header.

    Razorpay signs the RAW request body with the Webhook Secret (a different
    secret from the Key Secret, configured when the webhook is registered).
    """
    secret = get_settings().razorpay_webhook_secret
    if not secret:
        return False
    expected = hmac.new(
        secret.encode("utf-8"),
        msg=raw_body,
        digestmod=hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)
