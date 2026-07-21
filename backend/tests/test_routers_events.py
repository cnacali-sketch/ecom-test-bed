"""Tests for /api/events (first-party behavior tracking)."""
import uuid
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_record_page_view(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/events", json={"user_id": "anon-1", "event_type": "page_view", "path": "/"}
    )
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_unknown_event_type_is_silently_dropped(client: AsyncClient) -> None:
    # Must never error — a tracking call failing must not surface to the user.
    resp = await client.post(
        "/api/events", json={"user_id": "anon-1", "event_type": "definitely_not_real"}
    )
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_record_event_requires_no_auth(client: AsyncClient) -> None:
    # Anonymous browsing must be trackable without a login.
    resp = await client.post(
        "/api/events", json={"user_id": "anon-guest-session", "event_type": "product_view"}
    )
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_summary_requires_admin(client: AsyncClient) -> None:
    resp = await client.get("/api/events/summary")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_summary_as_customer_403(customer_client: AsyncClient) -> None:
    resp = await customer_client.get("/api/events/summary")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_summary_counts_by_event_type(admin_client: AsyncClient) -> None:
    for _ in range(3):
        await admin_client.post("/api/events", json={"user_id": "a", "event_type": "page_view"})
    await admin_client.post("/api/events", json={"user_id": "a", "event_type": "add_to_cart"})

    resp = await admin_client.get("/api/events/summary")
    assert resp.status_code == 200
    body = resp.json()
    assert body["counts"]["page_view"] == 3
    assert body["counts"]["add_to_cart"] == 1
    assert body["total_events"] == 4


@pytest.mark.asyncio
async def test_summary_ranks_top_viewed_products(admin_client: AsyncClient) -> None:
    product = await admin_client.post(
        "/api/products",
        json={
            "sku": f"EVT-{uuid.uuid4().hex[:8]}",
            "slug": f"evt-test-{uuid.uuid4().hex[:8]}",
            "name": "Popular Product",
            "price": "199.00",
            "mrp": "199.00",
            "in_stock": True,
            "attrs": {},
            "variants": [],
        },
    )
    product_id = product.json()["id"]

    for _ in range(5):
        await admin_client.post(
            "/api/events",
            json={"user_id": "a", "event_type": "product_view", "product_id": product_id},
        )

    resp = await admin_client.get("/api/events/summary")
    assert resp.status_code == 200
    top = resp.json()["top_products"]
    assert top[0]["product_id"] == product_id
    assert top[0]["views"] == 5
    assert top[0]["name"] == "Popular Product"
