"""Client IP extraction — shared by events.py (behavior tracking) and
orders.py (fraud review needs the IP that actually placed an order).
"""
import hashlib
import hmac

from fastapi import Request

from app.config import get_settings


def client_ip(request: Request) -> str:
    """Best-effort client IP.

    Reads request.client.host, not the X-Forwarded-For header directly:
    uvicorn's ProxyHeadersMiddleware (--proxy-headers, enabled in
    backend/Dockerfile) already parses that header and rewrites
    request.client.host to the real visitor IP, correctly peeling the chain
    at the trusted hop. Parsing X-Forwarded-For by hand here again would
    trust whatever value a client sends as its own leftmost entry — a client
    hitting the domain directly can set that to anything, since a proxy that
    appends (Caddy's default) puts the real IP at the END of the chain, not
    the start. IP-derived signals stay advisory leads to investigate, never
    an authorization or auto-block decision, even though this is no longer
    trivially spoofable."""
    return request.client.host if request.client else "unknown"


def hash_ip(ip: str) -> str:
    """HMAC-SHA256 of the client IP, truncated to 16 hex chars. Keyed on a
    dedicated fraud_hash_secret (not a bare hash) so it can't be trivially
    rainbow-tabled back to real IPs. Kept alongside the raw IP (not a
    replacement for it) since existing fraud-grouping queries key on this."""
    settings = get_settings()
    digest = hmac.new(settings.fraud_hash_secret.encode(), ip.encode(), hashlib.sha256).hexdigest()
    return digest[:16]
