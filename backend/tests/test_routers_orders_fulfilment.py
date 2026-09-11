"""Fulfilment at batch size — filtering the work queue and moving several
orders at once.

Both existed only as per-order clicking before. A Friday pickup of twenty
parcels meant twenty expanded rows and twenty dropdowns, and there was no way
to ask "what still needs shipping today?" at all.
"""
import uuid
from decimal import Decimal

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import Product

_PRODUCT = uuid.uuid4()


@pytest_asyncio.fixture(autouse=True)
async def _seed(db_session: AsyncSession) -> None:
    db_session.add(
        Product(
            id=_PRODUCT,
            sku="FULFIL-1",
            slug="fulfilment-test-product",
            name="Fulfilment Test Product",
            price=Decimal("500.00"),
            mrp=Decimal("500.00"),
            in_stock=True,
            attrs={"stock": 100},
        )
    )
    await db_session.commit()


async def _order(client: AsyncClient, qty: int = 1) -> str:
    created = await client.post(
        "/api/orders",
        json={
            "user_id": "fulfil@example.com",
            "items": [{"product_id": str(_PRODUCT), "quantity": qty, "unit_price": "500.00"}],
            "terms_accepted": True,
            "terms_version": "2026-07-22",
        },
    )
    assert created.status_code == 201, created.text
    return created.json()["id"]


# ---- The work queue ----


@pytest.mark.asyncio
async def test_filtering_by_status_returns_only_that_status(
    client: AsyncClient, admin_client: AsyncClient
) -> None:
    shipped = await _order(client)
    await _order(client)  # stays pending
    await admin_client.patch(f"/api/orders/{shipped}/status?status=shipped")

    resp = await admin_client.get("/api/orders/all?status=shipped")

    assert resp.status_code == 200
    assert [o["id"] for o in resp.json()] == [shipped]


@pytest.mark.asyncio
async def test_several_statuses_can_be_asked_for_at_once(
    client: AsyncClient, admin_client: AsyncClient
) -> None:
    """"Open orders" is pending plus confirmed, and wanting it should not mean
    two round-trips or filtering the difference by eye."""
    pending = await _order(client)
    confirmed = await _order(client)
    delivered = await _order(client)
    await admin_client.patch(f"/api/orders/{confirmed}/status?status=confirmed")
    await admin_client.patch(f"/api/orders/{delivered}/status?status=delivered")

    resp = await admin_client.get("/api/orders/all?status=pending,confirmed")

    ids = {o["id"] for o in resp.json()}
    assert ids == {pending, confirmed}


@pytest.mark.asyncio
async def test_status_filter_combines_with_search(
    client: AsyncClient, admin_client: AsyncClient
) -> None:
    """Narrowing a queue by courier or AWB is the support case; the two filters
    have to intersect rather than one replacing the other."""
    wanted = await _order(client)
    other = await _order(client)
    await admin_client.patch(f"/api/orders/{wanted}/status?status=shipped")
    await admin_client.patch(f"/api/orders/{other}/status?status=shipped")
    await admin_client.patch(f"/api/orders/{wanted}/shipping?courier=Delhivery&tracking_number=AWB77")

    resp = await admin_client.get("/api/orders/all?status=shipped&q=AWB77")

    assert [o["id"] for o in resp.json()] == [wanted]


@pytest.mark.asyncio
async def test_an_unknown_status_is_refused_rather_than_returning_everything(
    admin_client: AsyncClient
) -> None:
    """A typo must not silently widen the queue to every order — that is how
    an order gets shipped twice."""
    resp = await admin_client.get("/api/orders/all?status=shippd")

    assert resp.status_code == 422
    assert "shippd" in resp.json()["detail"]


# ---- Moving a batch ----


@pytest.mark.asyncio
async def test_bulk_status_moves_every_named_order(
    client: AsyncClient, admin_client: AsyncClient
) -> None:
    ids = [await _order(client) for _ in range(3)]

    resp = await admin_client.patch(
        "/api/orders/bulk/status", json={"order_ids": ids, "status": "shipped"}
    )

    assert resp.status_code == 200, resp.text
    assert {o["status"] for o in resp.json()} == {"shipped"}
    listed = await admin_client.get("/api/orders/all?status=shipped")
    assert {o["id"] for o in listed.json()} == set(ids)


@pytest.mark.asyncio
async def test_bulk_cancel_returns_the_stock(
    client: AsyncClient, admin_client: AsyncClient, db_session: AsyncSession
) -> None:
    """The bulk path must not be a way around the stock rules. Cancelling
    twenty orders at once has to free the same units cancelling them one at a
    time would."""
    from sqlalchemy import select

    ids = [await _order(client, qty=10) for _ in range(3)]
    product = (await db_session.execute(select(Product).where(Product.id == _PRODUCT))).scalar_one()
    await db_session.refresh(product)
    assert product.attrs["stock"] == 70

    await admin_client.patch(
        "/api/orders/bulk/status", json={"order_ids": ids, "status": "cancelled"}
    )

    await db_session.refresh(product)
    assert product.attrs["stock"] == 100


@pytest.mark.asyncio
async def test_bulk_update_is_all_or_nothing(
    client: AsyncClient, admin_client: AsyncClient
) -> None:
    """A half-applied batch is worse than a refused one: nothing on screen
    says which half moved."""
    good = await _order(client)
    missing = str(uuid.uuid4())

    resp = await admin_client.patch(
        "/api/orders/bulk/status", json={"order_ids": [good, missing], "status": "shipped"}
    )

    assert resp.status_code == 404
    still = await admin_client.get("/api/orders/all")
    assert next(o for o in still.json() if o["id"] == good)["status"] == "pending"


@pytest.mark.asyncio
async def test_bulk_rejects_an_unknown_status(
    client: AsyncClient, admin_client: AsyncClient
) -> None:
    order_id = await _order(client)

    resp = await admin_client.patch(
        "/api/orders/bulk/status", json={"order_ids": [order_id], "status": "posted"}
    )

    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_bulk_requires_admin(
    client: AsyncClient, customer_client: AsyncClient
) -> None:
    order_id = await _order(client)

    resp = await customer_client.patch(
        "/api/orders/bulk/status", json={"order_ids": [order_id], "status": "shipped"}
    )

    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_bulk_needs_at_least_one_order(admin_client: AsyncClient) -> None:
    resp = await admin_client.patch(
        "/api/orders/bulk/status", json={"order_ids": [], "status": "shipped"}
    )

    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_bulk_route_is_not_parsed_as_an_order_id(
    client: AsyncClient, admin_client: AsyncClient
) -> None:
    """/bulk/status and /{order_id}/status have the same shape. Declared the
    wrong way round, "bulk" is read as an order id and the endpoint 422s on
    UUID parsing with a message about nothing."""
    order_id = await _order(client)

    resp = await admin_client.patch(
        "/api/orders/bulk/status", json={"order_ids": [order_id], "status": "confirmed"}
    )

    assert resp.status_code == 200
    assert resp.json()[0]["status"] == "confirmed"
