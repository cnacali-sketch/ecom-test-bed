"""One customer's order history.

Support's first question on any call is "what have you ordered from us
before". The console could not answer it: orders and customers were separate
screens with no link between them, and the only way across was a substring
search that could attach the wrong person's purchases to a name.

The awkward part is that a customer has two identities. A registered account's
orders carry its UUID; anything bought before they signed up carries the email
they typed at guest checkout. Both are theirs.
"""
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.order import Order
from app.models.user import User


async def _order(
    db: AsyncSession,
    user_id: str,
    total: str = "499.00",
    placed_at: datetime | None = None,
) -> Order:
    """`placed_at` is explicit wherever a test asserts on ordering.

    The column defaults to the database's own clock, which on SQLite is
    second-granular — two orders written in the same second tie, and the sort
    then falls back to a random UUID. Production is Postgres, where `now()` is
    the transaction timestamp and consecutive orders differ by microseconds,
    so this is an artefact of the test database rather than a real ambiguity.
    A test about order still has to control its own timestamps.
    """
    order = Order(
        user_id=user_id,
        total_amount=Decimal(total),
        shipping_address={"full_name": "Priya Nair", "city": "Bengaluru"},
        **({"created_at": placed_at} if placed_at else {}),
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)
    return order


async def _history(client: AsyncClient, customer_id) -> list[dict]:
    res = await client.get("/api/orders/all", params={"customer_id": str(customer_id)})
    assert res.status_code == 200, res.text
    return res.json()


@pytest.mark.asyncio
async def test_a_registered_accounts_orders_are_found_by_its_id(
    db_session: AsyncSession, admin_client: AsyncClient, customer_user: User
) -> None:
    mine = await _order(db_session, str(customer_user.id))
    await _order(db_session, str(uuid.uuid4()))

    assert [o["id"] for o in await _history(admin_client, customer_user.id)] == [str(mine.id)]


@pytest.mark.asyncio
async def test_orders_placed_as_a_guest_before_signing_up_still_count(
    db_session: AsyncSession, admin_client: AsyncClient, customer_user: User
) -> None:
    """The returning-customer case. Matching only the account UUID tells
    somebody who has shopped here for a year that they have no history."""
    as_guest = await _order(db_session, customer_user.email)
    as_account = await _order(db_session, str(customer_user.id))

    found = {o["id"] for o in await _history(admin_client, customer_user.id)}
    assert found == {str(as_guest.id), str(as_account.id)}


@pytest.mark.asyncio
async def test_a_guest_email_typed_in_a_different_case_still_matches(
    db_session: AsyncSession, admin_client: AsyncClient, customer_user: User
) -> None:
    """Guest checkout takes the email from a free-text field, so its casing is
    whatever was typed. The account's is normalised to lowercase."""
    shouty = await _order(db_session, customer_user.email.upper())

    assert [o["id"] for o in await _history(admin_client, customer_user.id)] == [str(shouty.id)]


@pytest.mark.asyncio
async def test_somebody_elses_order_is_never_attached(
    db_session: AsyncSession, admin_client: AsyncClient, customer_user: User
) -> None:
    """The reason this is an exact match rather than a reuse of `q`: that
    search covers the address blob, so an email appearing anywhere in another
    person's order would pull it into this customer's history."""
    await _order(db_session, "someone-else@example.com")
    db_session.add(
        Order(
            user_id="third-party@example.com",
            total_amount=Decimal("100.00"),
            # The customer's email sitting inside a different order's address.
            shipping_address={"line1": f"c/o {customer_user.email}", "city": "Chennai"},
        )
    )
    await db_session.commit()

    assert await _history(admin_client, customer_user.id) == []


@pytest.mark.asyncio
async def test_a_customer_with_no_orders_returns_an_empty_history(
    admin_client: AsyncClient, customer_user: User
) -> None:
    """Not a 404: the customer exists, they just have not bought anything."""
    assert await _history(admin_client, customer_user.id) == []


@pytest.mark.asyncio
async def test_an_unknown_customer_returns_nothing_rather_than_everything(
    db_session: AsyncSession, admin_client: AsyncClient
) -> None:
    """A deleted account must not fall through to an unfiltered list."""
    await _order(db_session, "someone@example.com")

    assert await _history(admin_client, uuid.uuid4()) == []


@pytest.mark.asyncio
async def test_history_is_newest_first(
    db_session: AsyncSession, admin_client: AsyncClient, customer_user: User
) -> None:
    now = datetime.now(timezone.utc)
    first = await _order(
        db_session, str(customer_user.id), total="100.00", placed_at=now - timedelta(days=30)
    )
    second = await _order(
        db_session, str(customer_user.id), total="200.00", placed_at=now
    )

    assert [o["id"] for o in await _history(admin_client, customer_user.id)] == [
        str(second.id),
        str(first.id),
    ]


@pytest.mark.asyncio
async def test_the_filter_is_off_by_default(
    db_session: AsyncSession, admin_client: AsyncClient, customer_user: User
) -> None:
    await _order(db_session, str(customer_user.id))
    await _order(db_session, "someone-else@example.com")

    assert len((await admin_client.get("/api/orders/all")).json()) == 2


@pytest.mark.asyncio
async def test_history_composes_with_a_status_filter(
    db_session: AsyncSession, admin_client: AsyncClient, customer_user: User
) -> None:
    """"Has this customer got anything still open?" is a real support question."""
    await _order(db_session, str(customer_user.id))
    shipped = await _order(db_session, str(customer_user.id))
    await admin_client.patch(f"/api/orders/{shipped.id}/status?status=shipped")

    res = await admin_client.get(
        "/api/orders/all",
        params={"customer_id": str(customer_user.id), "status": "shipped"},
    )
    assert [o["id"] for o in res.json()] == [str(shipped.id)]


@pytest.mark.asyncio
async def test_a_malformed_customer_id_is_refused(admin_client: AsyncClient) -> None:
    res = await admin_client.get("/api/orders/all", params={"customer_id": "priya@example.com"})
    assert res.status_code == 422
