"""Client IP extraction — shared by events.py (behavior tracking) and
orders.py (fraud review needs the IP that actually placed an order).
"""
import hashlib
import hmac

from fastapi import Request

from app.config import get_settings


def client_ip(request: Request) -> str:
    """Best-effort client IP. NOTE: X-Forwarded-For is trusted as-is, which
    assumes the app sits behind a proxy that overwrites it (Caddy in
    production). A client hitting the backend directly can forge this header
    — so IP-derived signals are advisory leads to investigate, never an
    authorization or auto-block decision."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def hash_ip(ip: str) -> str:
    """HMAC-SHA256 of the client IP, truncated to 16 hex chars. Keyed on a
    dedicated fraud_hash_secret (not a bare hash) so it can't be trivially
    rainbow-tabled back to real IPs. Kept alongside the raw IP (not a
    replacement for it) since existing fraud-grouping queries key on this."""
    settings = get_settings()
    digest = hmac.new(settings.fraud_hash_secret.encode(), ip.encode(), hashlib.sha256).hexdigest()
    return digest[:16]
