"""The one background job this app runs, and the rules it runs under.

A Celery worker was considered and declined: RabbitMQ already idles in this
stack serving a `ping` stub, and a seventh container to run one job a day at
eleven lifetime orders is infrastructure looking for a problem. An asyncio task
on the app's own lifespan is the smaller thing that works.

Smaller, not free -- a background task inside the web process has three ways to
hurt the thing it runs beside, and each is handled here rather than hoped away:

* **It must never take the API down.** Every iteration catches `Exception`, so
  a failed capture is a log line and a retry tomorrow, not a dead server. That
  is `Exception` and not `BaseException` for a reason: `CancelledError` has
  been a `BaseException` since Python 3.8, so shutdown still gets through a
  catch-all that would otherwise leave the task running until Docker killed
  the container.
* **It must not hold a database session open between runs.** The session is
  opened per iteration and closed before the sleep, rather than held for the
  twenty-four hours in between, where it would be a connection the pool has
  lost track of and the server may have closed under it anyway.
* **It must not run where it was not wanted.** Disabled by a single setting,
  and off by default under pytest, so a test suite never starts a loop that
  outlives the test that triggered it.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from app.db import async_session_factory
from app.services import inventory_snapshots

logger = logging.getLogger(__name__)

#: How long between captures. A day, because the reading is a daily one -- a
#: finer interval would record the same number repeatedly and the unique
#: constraint would reject all but the first anyway.
INTERVAL_SECONDS = 24 * 60 * 60

#: How long to wait before the first capture, so startup is never competing
#: with a database query nobody is waiting for. Short enough that a restart
#: still records the day.
STARTUP_DELAY_SECONDS = 30


async def _capture_once() -> None:
    async with async_session_factory() as session:
        written = await inventory_snapshots.capture(session)
    if written:
        logger.info("inventory snapshot: recorded %d product(s)", written)
    else:
        logger.debug("inventory snapshot: nothing to record")


async def run_inventory_snapshots(
    *, interval: float = INTERVAL_SECONDS, startup_delay: float = STARTUP_DELAY_SECONDS
) -> None:
    """Capture stock levels on a timer until cancelled."""
    await asyncio.sleep(startup_delay)
    while True:
        started = datetime.now(timezone.utc)
        try:
            await _capture_once()
        except Exception:
            # Logged with the traceback and otherwise ignored. The next run is
            # a day away, and a stock history with a missing day is a gap; a
            # web server that died taking checkout with it is an outage.
            logger.exception("inventory snapshot failed; will try again next interval")
        elapsed = (datetime.now(timezone.utc) - started).total_seconds()
        await asyncio.sleep(max(0.0, interval - elapsed))
