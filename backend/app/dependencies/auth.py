"""API key authentication dependency.

Protects write endpoints (POST /api/products, POST /api/orders, etc.)
from unauthenticated access. Gate:

1. Set API_KEY=<secret> in .env (or environment).
2. Clients send: `X-API-Key: <secret>` header.

ponytail: one shared key is enough for Phase 1 — add per-client keys
and a keys table when multi-tenant access is needed.
"""
from fastapi import HTTPException, Security
from fastapi.security import APIKeyHeader

from app.config import get_settings

_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def require_api_key(api_key: str | None = Security(_header)) -> None:
    """FastAPI dependency: raise 401 if X-API-Key header is missing or wrong.

    No-ops when API_KEY is not set in config (local dev without .env).
    """
    settings = get_settings()
    configured_key = getattr(settings, "api_key", None)

    if not configured_key:
        # No key configured → open access (local dev only)
        return

    if api_key != configured_key:
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing X-API-Key header",
            headers={"WWW-Authenticate": "ApiKey"},
        )
