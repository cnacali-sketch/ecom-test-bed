"""In-memory attempt throttle (brute-force / abuse brake) for auth endpoints.

Keys are opaque strings — logins are keyed by email, signup/refresh by client
IP. Callers pass their own limit so a cheap endpoint isn't held to the same
budget as bcrypt.

ponytail: a dict is enough for a single-process dev/staging backend. It does
NOT survive a restart and is NOT shared across workers — move this to Redis
(already a dependency) before running more than one backend process.
"""
from __future__ import annotations

import time
from collections import defaultdict

MAX_ATTEMPTS = 5
WINDOW_SECONDS = 300

_attempts: dict[str, list[float]] = defaultdict(list)


def _prune(key: str, now: float) -> list[float]:
    fresh = [t for t in _attempts[key] if now - t < WINDOW_SECONDS]
    _attempts[key] = fresh
    return fresh


def is_locked(key: str, max_attempts: int = MAX_ATTEMPTS) -> bool:
    """True when `key` has burned through `max_attempts` within the window."""
    return len(_prune(key, time.monotonic())) >= max_attempts


def record_failure(key: str) -> None:
    _attempts[key].append(time.monotonic())


def reset(key: str) -> None:
    """Clear the counter — called on a successful login."""
    _attempts.pop(key, None)


def client_key(request, prefix: str) -> str:
    """Throttle key derived from the caller's IP.

    Reads `request.client.host` directly and ignores X-Forwarded-For: behind a
    proxy every caller looks like the proxy (throttling everyone together), but
    trusting the header would let anyone forge a fresh identity per request and
    bypass the throttle entirely. Configure the proxy/uvicorn `--forwarded-allow-ips`
    before switching to forwarded headers.
    """
    host = request.client.host if request.client else "unknown"
    return f"{prefix}:{host}"
