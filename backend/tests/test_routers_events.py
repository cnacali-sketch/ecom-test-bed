"""Tests for /api/events (first-party behavior tracking)."""
import uuid
import pytest
from httpx import AsyncClient

from app.routers.events import AD_CLICK_FLAG_THRESHOLD, CHECKOUT_FLAG_THRESHOLD


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


# ---- Fraud/abuse summary (ad-click velocity, checkout velocity) ----

@pytest.mark.asyncio
async def test_fraud_summary_requires_admin(client: AsyncClient, customer_client: AsyncClient) -> None:
    anon = await client.get("/api/events/fraud-summary")
    assert anon.status_code == 401
    customer = await customer_client.get("/api/events/fraud-summary")
    assert customer.status_code == 403


@pytest.mark.asyncio
async def test_ad_click_flag_appears_after_threshold(admin_client: AsyncClient) -> None:
    for _ in range(AD_CLICK_FLAG_THRESHOLD):
        await admin_client.post(
            "/api/events",
            json={"user_id": "anon", "event_type": "page_view", "path": "/", "gclid": "abc123"},
        )
    resp = await admin_client.get("/api/events/fraud-summary")
    assert resp.status_code == 200
    flags = resp.json()["ad_click_flags"]
    assert len(flags) == 1
    assert flags[0]["ad_click_count"] == AD_CLICK_FLAG_THRESHOLD


@pytest.mark.asyncio
async def test_ad_click_flag_absent_below_threshold(admin_client: AsyncClient) -> None:
    for _ in range(AD_CLICK_FLAG_THRESHOLD - 1):
        await admin_client.post(
            "/api/events",
            json={"user_id": "anon", "event_type": "page_view", "path": "/", "fbclid": "xyz789"},
        )
    resp = await admin_client.get("/api/events/fraud-summary")
    assert resp.json()["ad_click_flags"] == []


@pytest.mark.asyncio
async def test_plain_page_views_never_count_as_ad_clicks(admin_client: AsyncClient) -> None:
    # No gclid/fbclid on any of these, however many there are — organic
    # browsing must never look like ad-click fraud.
    for _ in range(AD_CLICK_FLAG_THRESHOLD + 5):
        await admin_client.post("/api/events", json={"user_id": "anon", "event_type": "page_view", "path": "/"})
    resp = await admin_client.get("/api/events/fraud-summary")
    assert resp.json()["ad_click_flags"] == []


@pytest.mark.asyncio
async def test_checkout_velocity_flag_appears_after_threshold(admin_client: AsyncClient) -> None:
    for _ in range(CHECKOUT_FLAG_THRESHOLD):
        await admin_client.post("/api/events", json={"user_id": "anon", "event_type": "checkout_started"})
    resp = await admin_client.get("/api/events/fraud-summary")
    flags = resp.json()["checkout_velocity_flags"]
    assert len(flags) == 1
    assert flags[0]["checkout_event_count"] == CHECKOUT_FLAG_THRESHOLD
