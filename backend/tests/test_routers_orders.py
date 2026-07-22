"""Tests for /api/orders endpoints."""
import uuid
import pytest
from httpx import AsyncClient

from app.routers.orders import ORDER_MAX_PER_IP


@pytest.fixture
def product_id():
    return uuid.uuid4()


ORDER_PAYLOAD = {
    "user_id": "test-user-001",
    "items": [
        {"product_id": str(uuid.uuid4()), "quantity": 2, "unit_price": "649.00"},
        {"product_id": str(uuid.uuid4()), "quantity": 1, "unit_price": "999.00"},
    ],
    "terms_accepted": True,
    "terms_version": "2026-07-22",
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
async def test_order_creation_throttled_per_ip_after_threshold(client: AsyncClient) -> None:
    # Unauthenticated guest checkout + COD needs no payment confirmation, so
    # without this throttle a scripted loop could drain real stock for free —
    # this proves the cap actually engages rather than just existing in code.
    for _ in range(ORDER_MAX_PER_IP):
        resp = await client.post("/api/orders", json=ORDER_PAYLOAD)
        assert resp.status_code == 201
    resp = await client.post("/api/orders", json=ORDER_PAYLOAD)
    assert resp.status_code == 429


@pytest.mark.asyncio
async def test_admin_order_creation_bypasses_throttle(admin_client: AsyncClient) -> None:
    for _ in range(ORDER_MAX_PER_IP + 1):
        resp = await admin_client.post("/api/orders", json=ORDER_PAYLOAD)
        assert resp.status_code == 201


@pytest.mark.asyncio
async def test_list_orders(admin_client: AsyncClient) -> None:
    # GET /api/orders is the caller's OWN order history (or an admin viewing
    # anyone's, per the IDOR fix below) — anonymous listing is no longer
    # allowed, so this exercises the admin-bypass path.
    await admin_client.post("/api/orders", json=ORDER_PAYLOAD)
    await admin_client.post("/api/orders", json=ORDER_PAYLOAD)
    resp = await admin_client.get("/api/orders?user_id=test-user-001")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


# ---- Order history is gated to the caller's own account (or admin) ----

@pytest.mark.asyncio
async def test_list_orders_requires_auth(client: AsyncClient) -> None:
    resp = await client.get("/api/orders?user_id=test-user-001")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_customer_cannot_list_another_users_orders(customer_client: AsyncClient) -> None:
    resp = await customer_client.get("/api/orders?user_id=someone-elses-id")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_customer_can_list_own_orders(customer_client: AsyncClient) -> None:
    create = await customer_client.post("/api/orders", json=ORDER_PAYLOAD)
    own_id = create.json()["user_id"]  # overridden to the customer's real id
    assert own_id != ORDER_PAYLOAD["user_id"]  # proves the anti-spoofing override fired
    resp = await customer_client.get(f"/api/orders?user_id={own_id}")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


@pytest.mark.asyncio
async def test_admin_order_creation_keeps_payload_user_id(admin_client: AsyncClient) -> None:
    # Admins place orders on behalf of customers — their own id must not be
    # force-substituted the way a plain customer's is.
    resp = await admin_client.post("/api/orders", json=ORDER_PAYLOAD)
    assert resp.json()["user_id"] == ORDER_PAYLOAD["user_id"]


# ---- Order confirmation email resolves for a logged-in customer, not just
# guests (order.user_id is their account UUID, not their email, once the
# anti-spoofing override fires — the notification path must still find them) ----

@pytest.mark.asyncio
async def test_logged_in_customer_order_id_is_not_their_email(customer_client: AsyncClient) -> None:
    resp = await customer_client.post("/api/orders", json=ORDER_PAYLOAD)
    user_id = resp.json()["user_id"]
    assert "@" not in user_id  # it's the account UUID, proving the override fired
    uuid.UUID(user_id)  # and it parses as one


@pytest.mark.asyncio
async def test_logged_in_customer_still_gets_a_confirmation_email(customer_client: AsyncClient) -> None:
    # No assertion on email content here (that's the dev-stub's job) — this
    # only proves the endpoint doesn't error while resolving the notify
    # address through the UUID -> account -> email lookup.
    resp = await customer_client.post("/api/orders", json=ORDER_PAYLOAD)
    assert resp.status_code == 201


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


# ---- Stock reservation on order creation ----

async def _make_tracked_product(admin_client: AsyncClient, stock: int) -> str:
    resp = await admin_client.post(
        "/api/products",
        json={
            "sku": f"STOCK-{uuid.uuid4().hex[:8]}",
            "slug": f"stock-test-{uuid.uuid4().hex[:8]}",
            "name": "Stock Test Product",
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
async def test_order_deducts_tracked_stock(admin_client: AsyncClient) -> None:
    product_id = await _make_tracked_product(admin_client, stock=10)
    resp = await admin_client.post(
        "/api/orders",
        json={"user_id": "u", "items": [{"product_id": product_id, "quantity": 3, "unit_price": "100.00"}]},
    )
    assert resp.status_code == 201

    product = (await admin_client.get(f"/api/products/{product_id}")).json()
    assert product["attrs"]["stock"] == 7


@pytest.mark.asyncio
async def test_order_rejected_when_insufficient_stock(admin_client: AsyncClient) -> None:
    product_id = await _make_tracked_product(admin_client, stock=2)
    resp = await admin_client.post(
        "/api/orders",
        json={"user_id": "u", "items": [{"product_id": product_id, "quantity": 5, "unit_price": "100.00"}]},
    )
    assert resp.status_code == 409
    # Stock must be untouched by the rejected attempt.
    product = (await admin_client.get(f"/api/products/{product_id}")).json()
    assert product["attrs"]["stock"] == 2


@pytest.mark.asyncio
async def test_order_marks_product_out_of_stock_at_zero(admin_client: AsyncClient) -> None:
    product_id = await _make_tracked_product(admin_client, stock=2)
    resp = await admin_client.post(
        "/api/orders",
        json={"user_id": "u", "items": [{"product_id": product_id, "quantity": 2, "unit_price": "100.00"}]},
    )
    assert resp.status_code == 201
    product = (await admin_client.get(f"/api/products/{product_id}")).json()
    assert product["attrs"]["stock"] == 0
    assert product["in_stock"] is False


@pytest.mark.asyncio
async def test_order_against_unknown_product_still_succeeds(client: AsyncClient) -> None:
    # No product row behind this id at all — untracked, not an error. Matches
    # the pre-existing contract (order creation never validated existence).
    resp = await client.post(
        "/api/orders",
        json={
            "user_id": "u",
            "items": [{"product_id": str(uuid.uuid4()), "quantity": 999, "unit_price": "1.00"}],
            "terms_accepted": True,
            "terms_version": "2026-07-22",
        },
    )
    assert resp.status_code == 201
    assert resp.json()["flagged"] is False


@pytest.mark.asyncio
async def test_order_price_mismatch_flags_but_charges_server_price(admin_client: AsyncClient) -> None:
    product_id = await _make_tracked_product(admin_client, stock=10)
    resp = await admin_client.post(
        "/api/orders",
        json={"user_id": "u", "items": [{"product_id": product_id, "quantity": 1, "unit_price": "1.00"}]},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["total_amount"] == "100.00"
    assert body["flagged"] is True
    assert "Stock Test Product" in body["flag_reason"]


@pytest.mark.asyncio
async def test_order_matching_price_is_not_flagged(admin_client: AsyncClient) -> None:
    product_id = await _make_tracked_product(admin_client, stock=10)
    resp = await admin_client.post(
        "/api/orders",
        json={"user_id": "u", "items": [{"product_id": product_id, "quantity": 1, "unit_price": "100.00"}]},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["flagged"] is False
    assert body["flag_reason"] is None


# ---- Shipping address snapshot + payment method ----

@pytest.mark.asyncio
async def test_order_snapshots_shipping_address(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/orders",
        json={
            **ORDER_PAYLOAD,
            "shipping_address": {"line1": "12 Rose Ln", "city": "Mumbai", "postcode": "400001"},
        },
    )
    assert resp.status_code == 201
    assert resp.json()["shipping_address"]["city"] == "Mumbai"


@pytest.mark.asyncio
async def test_order_defaults_to_cod(client: AsyncClient) -> None:
    resp = await client.post("/api/orders", json=ORDER_PAYLOAD)
    assert resp.json()["payment_method"] == "cod"


@pytest.mark.asyncio
async def test_order_rejects_invalid_payment_method(client: AsyncClient) -> None:
    resp = await client.post("/api/orders", json={**ORDER_PAYLOAD, "payment_method": "bitcoin"})
    assert resp.status_code == 422


# ---- Shipping (courier + tracking) ----

@pytest.mark.asyncio
async def test_set_shipping_as_admin(admin_client: AsyncClient) -> None:
    create = await admin_client.post("/api/orders", json=ORDER_PAYLOAD)
    order_id = create.json()["id"]
    resp = await admin_client.patch(
        f"/api/orders/{order_id}/shipping?courier=Delhivery&tracking_number=DL123456789"
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["courier"] == "Delhivery"
    assert body["tracking_number"] == "DL123456789"


@pytest.mark.asyncio
async def test_set_shipping_unauthenticated_401(client: AsyncClient) -> None:
    create = await client.post("/api/orders", json=ORDER_PAYLOAD)
    order_id = create.json()["id"]
    resp = await client.patch(f"/api/orders/{order_id}/shipping?courier=X")
    assert resp.status_code == 401


# ---- T&C consent audit trail ----

@pytest.mark.asyncio
async def test_guest_order_requires_terms_accepted(client: AsyncClient) -> None:
    resp = await client.post("/api/orders", json={**ORDER_PAYLOAD, "terms_accepted": False})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_customer_order_requires_terms_accepted(customer_client: AsyncClient) -> None:
    resp = await customer_client.post("/api/orders", json={**ORDER_PAYLOAD, "terms_accepted": False})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_admin_order_bypasses_terms_requirement(admin_client: AsyncClient) -> None:
    # No checkbox exists behind an admin-entered phone order — same exception
    # as the user_id anti-spoofing override.
    resp = await admin_client.post("/api/orders", json={**ORDER_PAYLOAD, "terms_accepted": False})
    assert resp.status_code == 201
    assert resp.json()["terms_version"] is None
    assert resp.json()["terms_accepted_at"] is None


@pytest.mark.asyncio
async def test_guest_order_requires_terms_version_not_just_flag(client: AsyncClient) -> None:
    # terms_accepted=True but no version is an incomplete audit record — reject
    # it rather than persist a consent row with a null version.
    payload = {**ORDER_PAYLOAD, "terms_accepted": True}
    payload.pop("terms_version")
    resp = await client.post("/api/orders", json=payload)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_order_persists_terms_version_and_timestamp(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/orders", json={**ORDER_PAYLOAD, "terms_accepted": True, "terms_version": "2026-07-22"}
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["terms_version"] == "2026-07-22"
    assert body["terms_accepted_at"] is not None


# ---- Coupon redemption at checkout ----

async def _make_coupon(admin_client: AsyncClient, **overrides) -> str:
    payload = {
        "code": f"ORD{uuid.uuid4().hex[:6]}",
        "discount_type": "percent",
        "value": "10.00",
    }
    payload.update(overrides)
    resp = await admin_client.post("/api/coupons", json=payload)
    assert resp.status_code == 201
    return resp.json()["code"]


@pytest.mark.asyncio
async def test_order_applies_valid_coupon(admin_client: AsyncClient) -> None:
    code = await _make_coupon(admin_client, discount_type="flat", value="200.00")
    resp = await admin_client.post("/api/orders", json={**ORDER_PAYLOAD, "coupon_code": code})
    assert resp.status_code == 201
    body = resp.json()
    assert body["coupon_code"] == code
    assert body["discount_amount"] == "200.00"
    assert float(body["total_amount"]) == pytest.approx(2297.0 - 200.0)


@pytest.mark.asyncio
async def test_order_rejects_invalid_coupon_code(client: AsyncClient) -> None:
    resp = await client.post("/api/orders", json={**ORDER_PAYLOAD, "coupon_code": "DOES-NOT-EXIST"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_order_coupon_usage_limit_enforced(admin_client: AsyncClient) -> None:
    code = await _make_coupon(admin_client, usage_limit=1)
    first = await admin_client.post("/api/orders", json={**ORDER_PAYLOAD, "coupon_code": code})
    assert first.status_code == 201
    second = await admin_client.post("/api/orders", json={**ORDER_PAYLOAD, "coupon_code": code})
    assert second.status_code == 422
