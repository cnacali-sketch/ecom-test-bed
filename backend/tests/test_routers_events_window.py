"""The analytics date window.

The summary reported on all time and nothing else, which makes it nearly
useless for a decision: "we've had 4,000 page views ever" does not tell a shop
whether last week worked. Every figure it returns is now narrowed by the same
window — including the shipping locations, which come from a different table
and would otherwise sit on the same screen describing a different period.
"""
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.order import Order
from app.models.product import Product
from app.models.user_event import UserEvent

_PRODUCT = uuid.uuid4()

# A fixed "today" so the tests describe calendar days rather than drifting
# with the clock. Every row below is placed relative to it.
TODAY = date(2026, 9, 12)


def _at(day: date, hour: int = 12) -> datetime:
    return datetime(day.year, day.month, day.day, hour, tzinfo=timezone.utc)


@pytest_asyncio.fixture(autouse=True)
async def _seed(db_session: AsyncSession) -> None:
    db_session.add(
        Product(
            id=_PRODUCT,
            sku="WIN-1",
            slug="window-test-product",
            name="Window Test Product",
            price=Decimal("100.00"),
            mrp=Decimal("100.00"),
            in_stock=True,
        )
    )
    await db_session.commit()


async def _event(
    db: AsyncSession,
    day: date,
    *,
    event_type: str = "page_view",
    hour: int = 12,
    user_agent: str = "Mozilla/5.0 (Windows NT 10.0) Chrome/120",
) -> None:
    db.add(
        UserEvent(
            user_id="visitor-1",
            event_type=event_type,
            payload={"product_id": str(_PRODUCT)} if event_type == "product_view" else {},
            user_agent=user_agent,
            created_at=_at(day, hour),
        )
    )
    await db.commit()


async def _order_from(db: AsyncSession, day: date, city: str) -> None:
    db.add(
        Order(
            user_id="buyer@example.com",
            total_amount=Decimal("100.00"),
            shipping_address={"city": city, "state": "Karnataka", "country": "IN"},
            created_at=_at(day),
        )
    )
    await db.commit()


async def _summary(client: AsyncClient, **params) -> dict:
    res = await client.get("/api/events/summary", params=params)
    assert res.status_code == 200, res.text
    return res.json()


# ---- the window itself ----

@pytest.mark.asyncio
async def test_no_dates_still_reports_on_everything(
    db_session: AsyncSession, admin_client: AsyncClient
) -> None:
    """Adding the window must not change what the screen showed before it."""
    await _event(db_session, TODAY - timedelta(days=400))
    await _event(db_session, TODAY)

    assert (await _summary(admin_client))["total_events"] == 2


@pytest.mark.asyncio
async def test_events_outside_the_window_are_excluded(
    db_session: AsyncSession, admin_client: AsyncClient
) -> None:
    await _event(db_session, TODAY - timedelta(days=30))
    await _event(db_session, TODAY - timedelta(days=2))

    summary = await _summary(
        admin_client,
        start=(TODAY - timedelta(days=7)).isoformat(),
        end=TODAY.isoformat(),
    )
    assert summary["total_events"] == 1


@pytest.mark.asyncio
async def test_the_end_date_includes_that_whole_day(
    db_session: AsyncSession, admin_client: AsyncClient
) -> None:
    """The bug this guards against: a `<=` comparison against a date stops at
    midnight and silently drops everything that happened during the last day
    of the range, making the period look quieter than it was."""
    await _event(db_session, TODAY, hour=0)
    await _event(db_session, TODAY, hour=23)

    summary = await _summary(admin_client, start=TODAY.isoformat(), end=TODAY.isoformat())
    assert summary["total_events"] == 2


@pytest.mark.asyncio
async def test_the_start_date_includes_that_whole_day(
    db_session: AsyncSession, admin_client: AsyncClient
) -> None:
    await _event(db_session, TODAY, hour=0)
    await _event(db_session, TODAY - timedelta(days=1), hour=23)

    summary = await _summary(admin_client, start=TODAY.isoformat())
    assert summary["total_events"] == 1


@pytest.mark.asyncio
async def test_either_bound_can_stand_alone(
    db_session: AsyncSession, admin_client: AsyncClient
) -> None:
    """"Everything since the campaign started" and "everything up to the sale"
    are both real questions, and neither needs the other bound."""
    await _event(db_session, TODAY - timedelta(days=10))
    await _event(db_session, TODAY)

    since = await _summary(admin_client, start=(TODAY - timedelta(days=5)).isoformat())
    until = await _summary(admin_client, end=(TODAY - timedelta(days=5)).isoformat())
    assert (since["total_events"], until["total_events"]) == (1, 1)


@pytest.mark.asyncio
async def test_a_backwards_range_is_refused(admin_client: AsyncClient) -> None:
    """Silently swapping them would answer a question nobody asked; returning
    zero would read as "nothing happened"."""
    res = await admin_client.get(
        "/api/events/summary",
        params={"start": TODAY.isoformat(), "end": (TODAY - timedelta(days=1)).isoformat()},
    )
    assert res.status_code == 422
    assert "after the end date" in res.json()["detail"]


@pytest.mark.asyncio
async def test_a_malformed_date_is_refused(admin_client: AsyncClient) -> None:
    res = await admin_client.get("/api/events/summary", params={"start": "last tuesday"})
    assert res.status_code == 422


# ---- every figure honours the same window ----

@pytest.mark.asyncio
async def test_top_products_honour_the_window(
    db_session: AsyncSession, admin_client: AsyncClient
) -> None:
    await _event(db_session, TODAY - timedelta(days=30), event_type="product_view")
    await _event(db_session, TODAY, event_type="product_view")

    summary = await _summary(admin_client, start=TODAY.isoformat())
    assert [p["views"] for p in summary["top_products"]] == [1]


@pytest.mark.asyncio
async def test_device_and_browser_counts_honour_the_window(
    db_session: AsyncSession, admin_client: AsyncClient
) -> None:
    await _event(
        db_session,
        TODAY - timedelta(days=30),
        user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/605",
    )
    await _event(db_session, TODAY, user_agent="Mozilla/5.0 (Windows NT 10.0) Chrome/120")

    summary = await _summary(admin_client, start=TODAY.isoformat())
    assert sum(summary["device_counts"].values()) == 1
    assert sum(summary["browser_counts"].values()) == 1


@pytest.mark.asyncio
async def test_shipping_locations_honour_the_window_too(
    db_session: AsyncSession, admin_client: AsyncClient
) -> None:
    """Locations come from `orders`, not `user_events`. Narrowing one table
    and not the other puts last week's funnel beside all-time locations on the
    same screen, with nothing on it saying they describe different periods."""
    await _order_from(db_session, TODAY - timedelta(days=30), "Chennai")
    await _order_from(db_session, TODAY, "Bengaluru")

    summary = await _summary(admin_client, start=TODAY.isoformat())
    assert [loc["city"] for loc in summary["top_locations"]] == ["Bengaluru"]
    assert summary["country_counts"] == {"IN": 1}


@pytest.mark.asyncio
async def test_the_response_says_which_window_it_covered(
    db_session: AsyncSession, admin_client: AsyncClient
) -> None:
    """So the screen can label the figures. A number under the wrong heading
    is worse than no number."""
    await _event(db_session, TODAY)
    summary = await _summary(admin_client, start=TODAY.isoformat(), end=TODAY.isoformat())

    assert summary["start"] == TODAY.isoformat()
    assert summary["end"] == TODAY.isoformat()
    assert (await _summary(admin_client))["start"] is None


@pytest.mark.asyncio
async def test_an_empty_window_reports_zero_rather_than_failing(
    db_session: AsyncSession, admin_client: AsyncClient
) -> None:
    """A quiet week is a real answer and has to render, not error."""
    await _event(db_session, TODAY)

    summary = await _summary(
        admin_client,
        start=(TODAY - timedelta(days=100)).isoformat(),
        end=(TODAY - timedelta(days=90)).isoformat(),
    )
    assert summary["total_events"] == 0
    assert summary["counts"] == {}
    assert summary["top_products"] == []
    assert summary["top_locations"] == []


@pytest.mark.asyncio
async def test_the_summary_is_still_admin_only(
    staff_client: AsyncClient, customer_client: AsyncClient
) -> None:
    """Revenue and traffic are the owner's business. The window must not have
    widened who can ask."""
    assert (await staff_client.get("/api/events/summary")).status_code == 403
    assert (await customer_client.get("/api/events/summary")).status_code == 403
