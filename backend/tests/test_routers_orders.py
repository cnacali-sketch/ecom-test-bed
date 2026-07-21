"""Tests for /api/orders endpoints."""
import uuid
import pytest
from httpx import AsyncClient


@pytest.fixture
def product_id():
    return uuid.uuid4()


ORDER_PAYLOAD = {
    "user_id": "test-user-001",
    "items": [
        {"product_id": str(uuid.uuid4()), "quantity": 2, "unit_price": "649.00"},
        {"product_id": str(uuid.uuid4()), "quantity": 1, "unit_price": "999.00"},
    ],
}


@pytest.mark.asyncio
async def test_create_order(client: AsyncClient) -> None:
    resp = await client.post("/api/orders", json=ORDER_PAYLOAD)
    assert resp.status_code == 201
    data = resp.json()
    assert data["user_id"] == "test-user-001"
    assert data["status"] == "pending"
    # total = (649 * 2) + (999 * 1) = 2297
    assert float(data["total_amount"]) == pytest.approx(2297.0)
    assert len(data["items"]) == 2


@pytest.mark.asyncio
async def test_list_orders(client: AsyncClient) -> None:
    await client.post("/api/orders", json=ORDER_PAYLOAD)
    await client.post("/api/orders", json=ORDER_PAYLOAD)
    resp = await client.get("/api/orders?user_id=test-user-001")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


@pytest.mark.asyncio
async def test_get_order(client: AsyncClient) -> None:
    create = await client.post("/api/orders", json=ORDER_PAYLOAD)
    order_id = create.json()["id"]
    resp = await client.get(f"/api/orders/{order_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == order_id


@pytest.mark.asyncio
async def test_get_order_404(client: AsyncClient) -> None:
    resp = await client.get(f"/api/orders/{uuid.uuid4()}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_status(admin_client: AsyncClient) -> None:
    create = await admin_client.post("/api/orders", json=ORDER_PAYLOAD)
    order_id = create.json()["id"]
    resp = await admin_client.patch(f"/api/orders/{order_id}/status?status=confirmed")
    assert resp.status_code == 200
    assert resp.json()["status"] == "confirmed"


@pytest.mark.asyncio
async def test_invalid_status(admin_client: AsyncClient) -> None:
    create = await admin_client.post("/api/orders", json=ORDER_PAYLOAD)
    order_id = create.json()["id"]
    resp = await admin_client.patch(f"/api/orders/{order_id}/status?status=exploded")
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_empty_order_rejected(client: AsyncClient) -> None:
    resp = await client.post("/api/orders", json={"user_id": "u", "items": []})
    assert resp.status_code == 422


# ---- Write gate: guest checkout stays open, status transitions are admin-only ----

@pytest.mark.asyncio
async def test_guest_can_create_order(client: AsyncClient) -> None:
    """Checkout must not require an account (decision: guest checkout stays open)."""
    resp = await client.post("/api/orders", json=ORDER_PAYLOAD)
    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_update_status_unauthenticated_returns_401(client: AsyncClient) -> None:
    create = await client.post("/api/orders", json=ORDER_PAYLOAD)
    order_id = create.json()["id"]
    resp = await client.patch(f"/api/orders/{order_id}/status?status=confirmed")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_update_status_as_customer_returns_403(customer_client: AsyncClient) -> None:
    create = await customer_client.post("/api/orders", json=ORDER_PAYLOAD)
    order_id = create.json()["id"]
    resp = await customer_client.patch(f"/api/orders/{order_id}/status?status=confirmed")
    assert resp.status_code == 403


# ---- Admin all-orders listing ----

@pytest.mark.asyncio
async def test_list_all_orders_as_admin(admin_client: AsyncClient) -> None:
    await admin_client.post("/api/orders", json={**ORDER_PAYLOAD, "user_id": "u-a"})
    await admin_client.post("/api/orders", json={**ORDER_PAYLOAD, "user_id": "u-b"})
    resp = await admin_client.get("/api/orders/all")
    assert resp.status_code == 200
    users = {o["user_id"] for o in resp.json()}
    assert {"u-a", "u-b"} <= users


@pytest.mark.asyncio
async def test_list_all_orders_unauthenticated_401(client: AsyncClient) -> None:
    resp = await client.get("/api/orders/all")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_list_all_orders_as_customer_403(customer_client: AsyncClient) -> None:
    resp = await customer_client.get("/api/orders/all")
    assert resp.status_code == 403


# ---- Fulfilment: returned is a valid off-ramp ----

@pytest.mark.asyncio
async def test_status_returned_is_valid(admin_client: AsyncClient) -> None:
    create = await admin_client.post("/api/orders", json=ORDER_PAYLOAD)
    order_id = create.json()["id"]
    resp = await admin_client.patch(f"/api/orders/{order_id}/status?status=returned")
    assert resp.status_code == 200
    assert resp.json()["status"] == "returned"


# ---- Payment status (transaction tracking / refund) ----

@pytest.mark.asyncio
async def test_new_order_is_unpaid(client: AsyncClient) -> None:
    resp = await client.post("/api/orders", json=ORDER_PAYLOAD)
    assert resp.json()["payment_status"] == "unpaid"


@pytest.mark.asyncio
async def test_mark_order_paid_then_refunded(admin_client: AsyncClient) -> None:
    create = await admin_client.post("/api/orders", json=ORDER_PAYLOAD)
    order_id = create.json()["id"]

    paid = await admin_client.patch(f"/api/orders/{order_id}/payment?payment_status=paid")
    assert paid.status_code == 200
    assert paid.json()["payment_status"] == "paid"

    refunded = await admin_client.patch(f"/api/orders/{order_id}/payment?payment_status=refunded")
    assert refunded.status_code == 200
    assert refunded.json()["payment_status"] == "refunded"


@pytest.mark.asyncio
async def test_invalid_payment_status_422(admin_client: AsyncClient) -> None:
    create = await admin_client.post("/api/orders", json=ORDER_PAYLOAD)
    order_id = create.json()["id"]
    resp = await admin_client.patch(f"/api/orders/{order_id}/payment?payment_status=wired")
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_update_payment_unauthenticated_401(client: AsyncClient) -> None:
    create = await client.post("/api/orders", json=ORDER_PAYLOAD)
    order_id = create.json()["id"]
    resp = await client.patch(f"/api/orders/{order_id}/payment?payment_status=paid")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_update_payment_as_customer_403(customer_client: AsyncClient) -> None:
    create = await customer_client.post("/api/orders", json=ORDER_PAYLOAD)
    order_id = create.json()["id"]
    resp = await customer_client.patch(f"/api/orders/{order_id}/payment?payment_status=paid")
    assert resp.status_code == 403
