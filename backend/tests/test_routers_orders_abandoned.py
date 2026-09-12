"""Abandoned payments — checkouts the customer started and walked away from.

Two orders can sit at pending/unpaid and mean opposite things:

* a **prepaid** one is a sale that did not happen. Razorpay's modal was open
  on the page the customer was looking at, they closed it, and no later step
  can finish it. There is nothing to pack.
* a **COD** one is a sale that *did* happen and is waiting on someone to pack
  it.

They look identical in a list. Acting on one as though it were the other is
either shipping goods nobody paid for, or ignoring a real order. These tests
pin the line between them.
"""
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.order import Order
from app.models.product import Product
from app.routers.orders import ABANDONED_PAYMENT_AFTER

_PRODUCT = uuid.uuid4()


@pytest_asyncio.fixture(autouse=True)
async def _seed(db_session: AsyncSession) -> None:
    db_session.add(
        Product(
            id=_PRODUCT,
            sku="ABND-1",
            slug="abandoned-test-product",
            name="Abandoned Test Product",
            price=Decimal("1499.00"),
            mrp=Decimal("1499.00"),
            in_stock=True,
        )
    )
    await db_session.commit()


async def _order(
    db: AsyncSession,
    *,
    method: str = "prepaid",
    payment: str = "unpaid",
    status: str = "pending",
    age: timedelta = ABANDONED_PAYMENT_AFTER + timedelta(hours=1),
    email: str = "walked-away@example.com",
) -> Order:
    """An order placed `age` ago.

    Written straight to the database rather than through the checkout
    endpoint: the age is the whole point of these tests, and there is no way
    to ask the API for an order that was placed three hours ago.
    """
    order = Order(
        user_id=email,
        total_amount=Decimal("1499.00"),
        payment_method=method,
        payment_status=payment,
        status=status,
        created_at=datetime.now(timezone.utc) - age,
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)
    return order


async def _abandoned(client: AsyncClient) -> list[dict]:
    listed = await client.get("/api/orders/all", params={"abandoned": "true"})
    assert listed.status_code == 200, listed.text
    return listed.json()


@pytest.mark.asyncio
async def test_a_prepaid_checkout_left_unpaid_is_abandoned(
    db_session: AsyncSession, admin_client: AsyncClient
) -> None:
    """A second, ordinary order sits alongside it deliberately. With only one
    row in the table, "filtered correctly" and "not filtered at all" return
    the same list, and the test cannot tell them apart."""
    order = await _order(db_session)
    await _order(db_session, method="cod", email="real-order@example.com")

    assert [o["id"] for o in await _abandoned(admin_client)] == [str(order.id)]


@pytest.mark.asyncio
async def test_an_unpaid_cod_order_is_not_abandoned(
    db_session: AsyncSession, admin_client: AsyncClient
) -> None:
    """The single most important line here. A COD order is unpaid by
    definition until the cash is collected at the door — treating it as
    abandoned would hide real work that somebody has to go and pack."""
    await _order(db_session, method="cod")
    assert await _abandoned(admin_client) == []


@pytest.mark.asyncio
async def test_a_checkout_still_in_progress_is_not_abandoned(
    db_session: AsyncSession, admin_client: AsyncClient
) -> None:
    """Somebody with the payment modal open right now has not abandoned
    anything. Listing them would have the shop chasing live customers."""
    await _order(db_session, age=timedelta(minutes=5))
    assert await _abandoned(admin_client) == []


@pytest.mark.asyncio
async def test_the_boundary_is_the_stated_window(
    db_session: AsyncSession, admin_client: AsyncClient
) -> None:
    """Just inside the window is live; just outside it is abandoned."""
    await _order(db_session, age=ABANDONED_PAYMENT_AFTER - timedelta(minutes=1), email="live@example.com")
    older = await _order(
        db_session, age=ABANDONED_PAYMENT_AFTER + timedelta(minutes=1), email="gone@example.com"
    )
    assert [o["id"] for o in await _abandoned(admin_client)] == [str(older.id)]


@pytest.mark.asyncio
async def test_the_window_is_two_hours(
    db_session: AsyncSession, admin_client: AsyncClient
) -> None:
    """Pinned as a concrete duration, not relative to the constant.

    The boundary test above derives its ages from ABANDONED_PAYMENT_AFTER, so
    changing that constant moves its goalposts with it and it keeps passing —
    which is exactly how a window silently widens to a day. This one states
    the number: a checkout left for three hours is gone, half an hour is not.
    Changing the window should fail here and be a deliberate edit.
    """
    assert ABANDONED_PAYMENT_AFTER == timedelta(hours=2)

    gone = await _order(db_session, age=timedelta(hours=3), email="gone@example.com")
    await _order(db_session, age=timedelta(minutes=30), email="still-here@example.com")

    assert [o["id"] for o in await _abandoned(admin_client)] == [str(gone.id)]


@pytest.mark.asyncio
async def test_a_paid_order_is_never_abandoned(
    db_session: AsyncSession, admin_client: AsyncClient
) -> None:
    await _order(db_session, payment="paid")
    assert await _abandoned(admin_client) == []


@pytest.mark.asyncio
async def test_an_already_cancelled_order_is_not_listed_again(
    db_session: AsyncSession, admin_client: AsyncClient
) -> None:
    """Cancelling one is how it leaves the list. If it came back the list
    could never be worked to empty."""
    await _order(db_session, status="cancelled")
    assert await _abandoned(admin_client) == []


@pytest.mark.asyncio
async def test_the_list_carries_what_is_needed_to_chase_the_customer(
    db_session: AsyncSession, admin_client: AsyncClient
) -> None:
    """An abandoned checkout is only worth listing if somebody can act on it,
    which means the contact details have to come with it."""
    await _order(db_session, email="priya@example.com")
    entry = (await _abandoned(admin_client))[0]
    assert entry["user_id"] == "priya@example.com"
    assert entry["total_amount"] == "1499.00"
    assert entry["payment_method"] == "prepaid"


@pytest.mark.asyncio
async def test_the_filter_is_off_by_default(
    db_session: AsyncSession, admin_client: AsyncClient
) -> None:
    """The unfiltered list is still every order — adding the parameter must
    not quietly change what the Orders screen shows on load."""
    await _order(db_session, method="cod")
    await _order(db_session, email="two@example.com")
    assert len((await admin_client.get("/api/orders/all")).json()) == 2


@pytest.mark.asyncio
async def test_cancelling_an_abandoned_order_clears_it_from_the_list(
    db_session: AsyncSession, admin_client: AsyncClient
) -> None:
    """End to end: the list is worked using the controls that already exist,
    with no new endpoint to cancel one."""
    order = await _order(db_session)
    assert len(await _abandoned(admin_client)) == 1

    cancelled = await admin_client.patch(f"/api/orders/{order.id}/status?status=cancelled")
    assert cancelled.status_code == 200

    assert await _abandoned(admin_client) == []


@pytest.mark.asyncio
async def test_staff_can_see_abandoned_checkouts(
    db_session: AsyncSession, staff_client: AsyncClient
) -> None:
    """Same gate as the rest of the order queue — it is a fulfilment view, and
    deciding an order is dead is not a money action."""
    await _order(db_session)
    assert len(await _abandoned(staff_client)) == 1


@pytest.mark.asyncio
async def test_abandoned_combines_with_search(
    db_session: AsyncSession, admin_client: AsyncClient
) -> None:
    """Support gets a call about one of them; the filters have to compose."""
    await _order(db_session, email="priya@example.com")
    await _order(db_session, email="raj@example.com")

    listed = await admin_client.get(
        "/api/orders/all", params={"abandoned": "true", "q": "raj@"}
    )
    assert [o["user_id"] for o in listed.json()] == ["raj@example.com"]


@pytest.mark.asyncio
async def test_the_database_is_not_mutated_by_listing(
    db_session: AsyncSession, admin_client: AsyncClient
) -> None:
    """A read is a read. This is a view over existing rows, not a sweep that
    cancels them — the decision to write one off stays a person's."""
    order = await _order(db_session)
    await _abandoned(admin_client)

    still = (await db_session.execute(select(Order).where(Order.id == order.id))).scalar_one()
    assert (still.status, still.payment_status) == ("pending", "unpaid")
