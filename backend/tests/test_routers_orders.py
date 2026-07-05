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
async def test_update_status(client: AsyncClient) -> None:
    create = await client.post("/api/orders", json=ORDER_PAYLOAD)
    order_id = create.json()["id"]
    resp = await client.patch(f"/api/orders/{order_id}/status?status=confirmed")
    assert resp.status_code == 200
    assert resp.json()["status"] == "confirmed"


@pytest.mark.asyncio
async def test_invalid_status(client: AsyncClient) -> None:
    create = await client.post("/api/orders", json=ORDER_PAYLOAD)
    order_id = create.json()["id"]
    resp = await client.patch(f"/api/orders/{order_id}/status?status=exploded")
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_empty_order_rejected(client: AsyncClient) -> None:
    resp = await client.post("/api/orders", json={"user_id": "u", "items": []})
    assert resp.status_code == 422
