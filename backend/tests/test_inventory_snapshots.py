"""Recording what the shelf held.

`inventory_snapshots` has existed since the first migration and has never held
a row. The job that fills it is worth testing for two reasons that have nothing
to do with trends: it decides what "no stock figure" means, and it runs on a
timer inside the web process, where a mistake is an outage rather than a wrong
number.
"""
import asyncio
import uuid
from datetime import date, timedelta
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventory_snapshot import InventorySnapshot
from app.models.product import Product
from app.services import inventory_snapshots, scheduler


async def _product(db: AsyncSession, sku: str, stock) -> Product:
    """A product whose `attrs["stock"]` is exactly what was passed in.

    `stock` is deliberately untyped: half of what this module tests is what
    happens when that value is not an integer.
    """
    attrs = {} if stock is _ABSENT else {"stock": stock}
    product = Product(
        sku=sku,
        slug=sku.lower(),
        name=f"Product {sku}",
        price=Decimal("100.00"),
        mrp=Decimal("100.00"),
        in_stock=True,
        attrs=attrs,
    )
    db.add(product)
    await db.commit()
    return product


_ABSENT = object()


# ---- what counts as a reading ----

@pytest.mark.asyncio
async def test_a_counted_product_is_recorded(db_session: AsyncSession) -> None:
    product = await _product(db_session, "SNAP-1", 7)

    written = await inventory_snapshots.capture(db_session)

    assert written == 1
    rows = (await db_session.execute(select(InventorySnapshot))).scalars().all()
    assert [(r.product_id, r.quantity) for r in rows] == [(product.id, 7)]


@pytest.mark.asyncio
async def test_zero_stock_is_a_reading_not_an_absence(db_session: AsyncSession) -> None:
    """Nought in stock is a fact about the shelf, and the most interesting one
    a stock history can hold. Skipping it would erase exactly the days worth
    looking back at."""
    await _product(db_session, "SNAP-ZERO", 0)

    written = await inventory_snapshots.capture(db_session)

    assert written == 1
    row = (await db_session.execute(select(InventorySnapshot))).scalar_one()
    assert row.quantity == 0


@pytest.mark.parametrize(
    ("label", "stock"),
    [
        ("absent", _ABSENT),
        ("null", None),
        ("a string", "12"),
        ("a boolean", True),
    ],
)
@pytest.mark.asyncio
async def test_an_uncounted_product_is_skipped_not_zeroed(
    db_session: AsyncSession, label: str, stock
) -> None:
    """Twenty-three of the thirty-three live products carry `"stock": null`.
    That is a valid, sellable state -- nobody is counting these -- and writing
    zero for them would put "sold out" in a table whose whole purpose is to be
    read back later by something that cannot ask what the zero meant.

    `True` is in this list because `bool` subclasses `int` in Python, so a
    stray `"stock": true` would otherwise sail through an isinstance check and
    be recorded as a quantity of one.
    """
    await _product(db_session, f"SNAP-{label.replace(' ', '-')}", stock)

    written = await inventory_snapshots.capture(db_session)

    assert written == 0
    assert (await db_session.execute(select(InventorySnapshot))).scalars().all() == []


# ---- running it twice ----

@pytest.mark.asyncio
async def test_running_twice_in_a_day_records_once(db_session: AsyncSession) -> None:
    """The job is on a timer and also has a button. Pressing the button after
    the timer already ran must be a no-op, not a second reading and not a
    unique-constraint error in the caller's face."""
    await _product(db_session, "SNAP-TWICE", 4)

    first = await inventory_snapshots.capture(db_session)
    second = await inventory_snapshots.capture(db_session)

    assert (first, second) == (1, 0)
    rows = (await db_session.execute(select(InventorySnapshot))).scalars().all()
    assert len(rows) == 1


@pytest.mark.asyncio
async def test_a_new_day_is_a_new_reading(db_session: AsyncSession) -> None:
    """The whole point: the same product, counted again tomorrow."""
    product = await _product(db_session, "SNAP-DAYS", 9)
    yesterday = date.today() - timedelta(days=1)

    await inventory_snapshots.capture(db_session, on=yesterday)
    await inventory_snapshots.capture(db_session)

    rows = (
        (
            await db_session.execute(
                select(InventorySnapshot).order_by(InventorySnapshot.snapshot_date)
            )
        )
        .scalars()
        .all()
    )
    assert [r.snapshot_date for r in rows] == [yesterday, date.today()]
    assert {r.product_id for r in rows} == {product.id}


@pytest.mark.asyncio
async def test_a_changed_count_is_visible_across_days(db_session: AsyncSession) -> None:
    """A history that recorded the same number regardless of the shelf would
    satisfy every test above and be worthless."""
    product = await _product(db_session, "SNAP-CHANGE", 10)
    await inventory_snapshots.capture(db_session, on=date.today() - timedelta(days=1))

    product.attrs = {"stock": 6}
    await db_session.commit()
    await inventory_snapshots.capture(db_session)

    rows = (
        (
            await db_session.execute(
                select(InventorySnapshot).order_by(InventorySnapshot.snapshot_date)
            )
        )
        .scalars()
        .all()
    )
    assert [r.quantity for r in rows] == [10, 6]


# ---- the endpoints ----

@pytest.mark.asyncio
async def test_the_history_is_admin_only(client: AsyncClient) -> None:
    """Stock levels are commercial information -- how fast the shop sells and
    how thin it is running."""
    assert (await client.get("/api/inventory/snapshots")).status_code == 401
    assert (await client.post("/api/inventory/snapshots/capture")).status_code == 401


@pytest.mark.asyncio
async def test_capture_endpoint_records_and_reports_how_many(
    admin_client: AsyncClient, db_session: AsyncSession
) -> None:
    await _product(db_session, "SNAP-API", 5)

    resp = await admin_client.post("/api/inventory/snapshots/capture")

    assert resp.status_code == 200
    assert resp.json() == {"recorded": 1}


@pytest.mark.asyncio
async def test_the_window_excludes_older_readings(
    admin_client: AsyncClient, db_session: AsyncSession
) -> None:
    """`days` has to actually cut the series, or the first busy year returns
    everything ever recorded to an admin screen."""
    product = await _product(db_session, "SNAP-WINDOW", 3)
    await inventory_snapshots.capture(db_session, on=date.today() - timedelta(days=40))
    await inventory_snapshots.capture(db_session)

    recent = await admin_client.get("/api/inventory/snapshots?days=7")
    everything = await admin_client.get("/api/inventory/snapshots?days=365")

    assert len(recent.json()) == 1
    assert len(everything.json()) == 2
    assert recent.json()[0]["product_id"] == str(product.id)


@pytest.mark.asyncio
async def test_filtering_by_product_returns_only_that_product(
    admin_client: AsyncClient, db_session: AsyncSession
) -> None:
    wanted = await _product(db_session, "SNAP-F1", 1)
    await _product(db_session, "SNAP-F2", 2)
    await inventory_snapshots.capture(db_session)

    resp = await admin_client.get(f"/api/inventory/snapshots?product_id={wanted.id}")

    assert [r["product_id"] for r in resp.json()] == [str(wanted.id)]


@pytest.mark.asyncio
async def test_an_unknown_product_id_is_empty_not_an_error(
    admin_client: AsyncClient,
) -> None:
    resp = await admin_client.get(f"/api/inventory/snapshots?product_id={uuid.uuid4()}")

    assert resp.status_code == 200
    assert resp.json() == []


# ---- the timer ----

@pytest.mark.asyncio
async def test_a_failing_capture_does_not_kill_the_loop(monkeypatch) -> None:
    """This task runs inside the web process. If a database blip could end it,
    the snapshots would stop silently and the first anyone would know is an
    empty chart months later -- and the failure mode of catching too little is
    an exception that propagates out of a bare `create_task`, which nothing is
    awaiting.
    """
    calls = []

    async def explode_then_work() -> None:
        calls.append(len(calls))
        if len(calls) == 1:
            raise RuntimeError("database went away")

    monkeypatch.setattr(scheduler, "_capture_once", explode_then_work)

    task = asyncio.create_task(
        scheduler.run_inventory_snapshots(interval=0.01, startup_delay=0)
    )
    await asyncio.sleep(0.08)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task

    assert len(calls) >= 2, "the loop stopped after the first failure"


@pytest.mark.asyncio
async def test_cancelling_stops_the_loop_even_mid_capture() -> None:
    """Shutdown has to get through the catch-all, including while a capture is
    in flight -- otherwise the container hangs until Docker kills it.

    Worth stating what makes this hold, because it is not the obvious thing:
    `CancelledError` has been a `BaseException` since Python 3.8, so the
    `except Exception` in the loop cannot swallow it. A test that cancels
    during the sleep between runs proves nothing, because that raises outside
    the try block either way -- so this one cancels while `_capture_once` is
    awaiting.

    `wait_for` rather than a bare `await`: if the loop ever did swallow the
    cancellation it would carry on, and a bare await would hang the suite
    instead of failing it.
    """
    entered = asyncio.Event()

    async def never_finishes() -> None:
        entered.set()
        await asyncio.sleep(60)

    scheduler_capture = scheduler._capture_once
    scheduler._capture_once = never_finishes
    try:
        task = asyncio.create_task(
            scheduler.run_inventory_snapshots(interval=60, startup_delay=0)
        )
        await asyncio.wait_for(entered.wait(), timeout=1)

        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await asyncio.wait_for(task, timeout=1)
    finally:
        scheduler._capture_once = scheduler_capture

    assert task.cancelled()
