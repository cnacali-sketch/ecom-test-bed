"""Tests for /api/returns endpoints."""
import uuid
import pytest
from httpx import AsyncClient


async def _make_untracked_product(admin_client: AsyncClient) -> str:
    """A real product with no stock tracking (attrs.stock unset) — order_items
    now has a real FK to products, so tests need an actual row, not a random
    UUID that happens to look like one."""
    resp = await admin_client.post(
        "/api/products",
        json={
            "sku": f"RET-{uuid.uuid4().hex[:8]}",
            "slug": f"return-test-{uuid.uuid4().hex[:8]}",
            "name": "Return Test Product",
            "price": "100.00",
            "mrp": "100.00",
            "in_stock": True,
            "attrs": {},
            "variants": [],
        },
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def _make_delivered_order(admin_client: AsyncClient, product_id: str | None = None, qty: int = 1) -> str:
    if product_id is None:
        product_id = await _make_untracked_product(admin_client)
    items = [{"product_id": product_id, "quantity": qty, "unit_price": "100.00"}]
    create = await admin_client.post("/api/orders", json={"user_id": "u", "items": items})
    order_id = create.json()["id"]
    await admin_client.patch(f"/api/orders/{order_id}/status?status=delivered")
    return order_id


async def _make_tracked_product(admin_client: AsyncClient, stock: int) -> str:
    resp = await admin_client.post(
        "/api/products",
        json={
            "sku": f"RET-{uuid.uuid4().hex[:8]}",
            "slug": f"return-test-{uuid.uuid4().hex[:8]}",
            "name": "Return Test Product",
            "price": "100.00",
            "mrp": "100.00",
            "in_stock": True,
            "attrs": {"stock": stock},
            "variants": [],
        },
    )
    assert resp.status_code == 201
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_create_return_request_on_delivered_order(admin_client: AsyncClient) -> None:
    order_id = await _make_delivered_order(admin_client)
    resp = await admin_client.post("/api/returns", json={"order_id": order_id, "reason": "Wrong size"})
    assert resp.status_code == 201
    assert resp.json()["status"] == "pending"


@pytest.mark.asyncio
async def test_create_return_request_requires_delivered(admin_client: AsyncClient) -> None:
    product_id = await _make_untracked_product(admin_client)
    create = await admin_client.post(
        "/api/orders", json={"user_id": "u", "items": [{"product_id": product_id, "quantity": 1, "unit_price": "100.00"}]}
    )
    order_id = create.json()["id"]  # still "pending", never marked delivered
    resp = await admin_client.post("/api/returns", json={"order_id": order_id, "reason": "Changed mind"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_return_request_duplicate_pending_409(admin_client: AsyncClient) -> None:
    order_id = await _make_delivered_order(admin_client)
    first = await admin_client.post("/api/returns", json={"order_id": order_id, "reason": "Wrong size"})
    assert first.status_code == 201
    second = await admin_client.post("/api/returns", json={"order_id": order_id, "reason": "Also wrong"})
    assert second.status_code == 409


@pytest.mark.asyncio
async def test_create_return_request_unknown_order_404(client: AsyncClient) -> None:
    resp = await client.post("/api/returns", json={"order_id": str(uuid.uuid4()), "reason": "N/A"})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_return_requests_requires_admin(client: AsyncClient, customer_client: AsyncClient) -> None:
    anon = await client.get("/api/returns")
    assert anon.status_code == 401
    customer = await customer_client.get("/api/returns")
    assert customer.status_code == 403


@pytest.mark.asyncio
async def test_approve_paid_return_refunds_and_restocks(admin_client: AsyncClient) -> None:
    product_id = await _make_tracked_product(admin_client, stock=10)
    order_id = await _make_delivered_order(admin_client, product_id=product_id, qty=3)
    # Money actually collected — so approval should refund it.
    await admin_client.patch(f"/api/orders/{order_id}/payment?payment_status=paid")

    product_after_order = (await admin_client.get(f"/api/products/{product_id}")).json()
    assert product_after_order["attrs"]["stock"] == 7  # deducted at order creation

    created = await admin_client.post("/api/returns", json={"order_id": order_id, "reason": "Defective"})
    request_id = created.json()["id"]

    resp = await admin_client.patch(f"/api/returns/{request_id}?status=approved")
    assert resp.status_code == 200
    assert resp.json()["status"] == "approved"
    assert resp.json()["resolved_at"] is not None

    order = (await admin_client.get(f"/api/orders/{order_id}")).json()
    assert order["payment_status"] == "refunded"
    assert order["status"] == "returned"

    product_after_return = (await admin_client.get(f"/api/products/{product_id}")).json()
    assert product_after_return["attrs"]["stock"] == 10  # restocked


@pytest.mark.asyncio
async def test_approve_unpaid_cod_return_restocks_but_does_not_mark_refunded(admin_client: AsyncClient) -> None:
    # A COD order where cash was never collected must NOT be marked "refunded"
    # on approval — no money moved back. It still restocks and marks returned.
    product_id = await _make_tracked_product(admin_client, stock=10)
    order_id = await _make_delivered_order(admin_client, product_id=product_id, qty=3)

    created = await admin_client.post("/api/returns", json={"order_id": order_id, "reason": "Defective"})
    request_id = created.json()["id"]
    resp = await admin_client.patch(f"/api/returns/{request_id}?status=approved")
    assert resp.status_code == 200

    order = (await admin_client.get(f"/api/orders/{order_id}")).json()
    assert order["payment_status"] == "unpaid"  # not falsely marked refunded
    assert order["status"] == "returned"
    product_after_return = (await admin_client.get(f"/api/products/{product_id}")).json()
    assert product_after_return["attrs"]["stock"] == 10  # still restocked


@pytest.mark.asyncio
async def test_reject_return_request_no_order_side_effects(admin_client: AsyncClient) -> None:
    order_id = await _make_delivered_order(admin_client)
    created = await admin_client.post("/api/returns", json={"order_id": order_id, "reason": "Defective"})
    request_id = created.json()["id"]

    resp = await admin_client.patch(f"/api/returns/{request_id}?status=rejected")
    assert resp.status_code == 200
    assert resp.json()["status"] == "rejected"

    order = (await admin_client.get(f"/api/orders/{order_id}")).json()
    assert order["payment_status"] == "unpaid"
    assert order["status"] == "delivered"


@pytest.mark.asyncio
async def test_resolve_already_resolved_request_409(admin_client: AsyncClient) -> None:
    order_id = await _make_delivered_order(admin_client)
    created = await admin_client.post("/api/returns", json={"order_id": order_id, "reason": "Defective"})
    request_id = created.json()["id"]
    await admin_client.patch(f"/api/returns/{request_id}?status=approved")
    resp = await admin_client.patch(f"/api/returns/{request_id}?status=rejected")
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_resolve_invalid_status_422(admin_client: AsyncClient) -> None:
    order_id = await _make_delivered_order(admin_client)
    created = await admin_client.post("/api/returns", json={"order_id": order_id, "reason": "Defective"})
    request_id = created.json()["id"]
    resp = await admin_client.patch(f"/api/returns/{request_id}?status=pending")
    assert resp.status_code == 422
