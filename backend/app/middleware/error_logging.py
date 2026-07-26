"""Captures server errors (500) and auth/permission denials (401/403) into
the error_logs table, so an admin can see what's actually failing without
SSH access to raw container logs — this is exactly the class of bug (a
silent CSRF/cookie-domain mismatch) that took a long back-and-forth to
diagnose by reading logs by hand.

Deliberately narrow: 404/422 are routine (bad id, invalid input) and would
just be noise; 401/403 are the ones worth an admin's attention because they
usually mean "something is broken for a real user," not "a user made a
typo."
"""
import json
import traceback

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.db import async_session_factory
from app.models.error_log import ErrorLog

_LOGGED_STATUSES = {401, 403}


async def _write_log(status_code: int, method: str, path: str, message: str, detail: str | None) -> None:
    try:
        async with async_session_factory() as db:
            db.add(
                ErrorLog(
                    status_code=status_code,
                    method=method,
                    path=path[:500],
                    message=message[:2000],
                    detail=detail[:8000] if detail else None,
                )
            )
            await db.commit()
    except Exception:
        # Logging errors must never crash the request that triggered them.
        pass


class ErrorLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        try:
            response = await call_next(request)
        except Exception as exc:
            await _write_log(500, request.method, request.url.path, str(exc), traceback.format_exc())
            raise

        if response.status_code in _LOGGED_STATUSES:
            # BaseHTTPMiddleware's call_next returns a streaming wrapper —
            # response.body is NOT populated the way a plain Response's is.
            # Must drain body_iterator to read it, then rebuild the response
            # with that same body so the client still receives it.
            body_chunks = [chunk async for chunk in response.body_iterator]
            body = b"".join(
                chunk if isinstance(chunk, bytes) else chunk.encode() for chunk in body_chunks
            )
            message = f"HTTP {response.status_code}"
            try:
                message = json.loads(body).get("detail", message)
            except Exception:
                pass
            await _write_log(response.status_code, request.method, request.url.path, message, None)
            return Response(
                content=body,
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type=response.media_type,
            )

        return response
