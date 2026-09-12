"""Tests for /api/orders endpoints."""
import uuid
from decimal import Decimal

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import Product
from app.routers.orders import ORDER_MAX_PER_IP


@pytest.fixture
def product_id():
    return uuid.uuid4()


# Fixed ids so ORDER_PAYLOAD can be a plain module-level constant reused by
# nearly every test below -- order_items.product_id is a real FK, so these
# two need an actual products row (see _seed_order_payload_products), not
# just a syntactically-valid UUID.
_PAYLOAD_PRODUCT_1 = uuid.uuid4()
_PAYLOAD_PRODUCT_2 = uuid.uuid4()

ORDER_PAYLOAD = {
    "user_id": "test-user-001",
    "items": [
        {"product_id": str(_PAYLOAD_PRODUCT_1), "quantity": 2, "unit_price": "649.00"},
        {"product_id": str(_PAYLOAD_PRODUCT_2), "quantity": 1, "unit_price": "999.00"},
    ],
    "terms_accepted": True,
    "terms_version": "2026-07-22",
}


@pytest_asyncio.fixture(autouse=True)
async def _seed_order_payload_products(db_session: AsyncSession) -> None:
    """Prices match ORDER_PAYLOAD's unit_price exactly so the price-authority
    check in create_order never flags these as a mismatch."""
    db_session.add_all(
        [
            Product(
                id=_PAYLOAD_PRODUCT_1,
                sku="ORDER-PAYLOAD-1",
                slug="order-payload-item-1",
                name="Order Payload Item 1",
                price=Decimal("649.00"),
                mrp=Decimal("649.00"),
            ),
            Product(
                id=_PAYLOAD_PRODUCT_2,
                sku="ORDER-PAYLOAD-2",
                slug="order-payload-item-2",
                name="Order Payload Item 2",
                price=Decimal("999.00"),
                mrp=Decimal("999.00"),
            ),
        ]
    )
    await db_session.commit()


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


# ---- Fraud-review fields must never reach the customer/guest ----

@pytest.mark.asyncio
async def test_create_order_response_omits_fraud_fields(client: AsyncClient) -> None:
    """flag_reason/ip_address are internal fraud-review fields -- the guest
    who just placed the order must never see them in their own confirmation."""
    resp = await client.post("/api/orders", json=ORDER_PAYLOAD)
    assert resp.status_code == 201
    body = resp.json()
    assert "flag_reason" not in body
    assert "ip_address" not in body


@pytest.mark.asyncio
async def test_public_order_tracker_omits_fraud_fields(client: AsyncClient) -> None:
    """GET /{order_id} is deliberately public (order id is the tracking
    credential) -- it must not leak WHY an order was flagged or the IP it
    was placed from back to whoever holds that id."""
    create = await client.post("/api/orders", json=ORDER_PAYLOAD)
    order_id = create.json()["id"]
    resp = await client.get(f"/api/orders/{order_id}")
    assert resp.status_code == 200
    body = resp.json()
    assert "flag_reason" not in body
    assert "ip_address" not in body
    assert "flagged" in body  # the boolean itself is fine to expose


@pytest.mark.asyncio
async def test_own_order_list_omits_fraud_fields(customer_client: AsyncClient) -> None:
    create = await customer_client.post("/api/orders", json=ORDER_PAYLOAD)
    assert create.status_code == 201
    own_id = create.json()["user_id"]  # customer's real id (anti-spoofing override)
    resp = await customer_client.get(f"/api/orders?user_id={own_id}")
    assert resp.status_code == 200
    assert len(resp.json()) >= 1
    for order in resp.json():
        assert "flag_reason" not in order
        assert "ip_address" not in order


@pytest.mark.asyncio
async def test_admin_all_orders_still_includes_fraud_fields(admin_client: AsyncClient) -> None:
    """The admin view is where these fields belong -- confirm the split
    didn't accidentally hide them from the people who need them."""
    await admin_client.post("/api/orders", json=ORDER_PAYLOAD)
    resp = await admin_client.get("/api/orders/all")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) >= 1
    assert "flag_reason" in body[0]
    assert "ip_address" in body[0]


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
    """Still a valid off-ramp -- but only once the goods have actually left.

    This used to jump a brand-new order straight to `returned`, back when the
    endpoint checked only that the word was a known one. Nothing was dispatched
    in that scenario, so there was nothing to come back; an order the customer
    changes their mind about before it ships is `cancelled`.
    """
    create = await admin_client.post("/api/orders", json=ORDER_PAYLOAD)
    order_id = create.json()["id"]
    await admin_client.patch(f"/api/orders/{order_id}/status?status=shipped")

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
async def test_order_against_unknown_product_is_rejected(client: AsyncClient) -> None:
    # order_items.product_id is a real FK on Postgres (not enforced by
    # SQLite, which is what let this slip through as "still succeeds" for a
    # long time — a load test against the real DB surfaced the unhandled
    # 500 this used to produce). Reject it cleanly instead.
    resp = await client.post(
        "/api/orders",
        json={
            "user_id": "u",
            "items": [{"product_id": str(uuid.uuid4()), "quantity": 999, "unit_price": "1.00"}],
            "terms_accepted": True,
            "terms_version": "2026-07-22",
        },
    )
    assert resp.status_code == 422


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


# ---- Line-item detail, device, and deletion (admin Orders screen) ----


@pytest.mark.asyncio
async def test_order_items_carry_the_product_they_are_for(
    client: AsyncClient, admin_client: AsyncClient
) -> None:
    """An order item stored only product_id, quantity and price.

    The admin Orders screen showed "1" in the ITEMS column with no way to find
    out what was actually bought, and the shopper's own order history had the
    same gap. The product is eager-loaded (lazy="selectin"), so this works on
    every endpoint that serialises an order rather than only the one that
    remembered to load it.
    """
    created = await client.post("/api/orders", json=ORDER_PAYLOAD)
    assert created.status_code == 201

    listed = await admin_client.get("/api/orders/all")

    assert listed.status_code == 200
    items = listed.json()[0]["items"]
    names = sorted(item["product"]["name"] for item in items)
    assert names == ["Order Payload Item 1", "Order Payload Item 2"]
    assert all(item["product"]["sku"] for item in items)


@pytest.mark.asyncio
async def test_public_order_tracker_also_shows_what_was_ordered(
    client: AsyncClient,
) -> None:
    """The guest tracker is the one place a customer can check an order, so it
    needs the product names too -- and must not start 500ing on the added
    relationship."""
    created = await client.post("/api/orders", json=ORDER_PAYLOAD)
    order_id = created.json()["id"]

    fetched = await client.get(f"/api/orders/{order_id}")

    assert fetched.status_code == 200
    assert fetched.json()["items"][0]["product"]["name"].startswith("Order Payload Item")


@pytest.mark.asyncio
async def test_order_records_the_device_it_was_placed_from(
    client: AsyncClient, admin_client: AsyncClient
) -> None:
    android = (
        "Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/126.0.0.0 Mobile Safari/537.36"
    )
    created = await client.post(
        "/api/orders", json=ORDER_PAYLOAD, headers={"User-Agent": android}
    )
    assert created.status_code == 201

    listed = await admin_client.get("/api/orders/all")

    assert listed.json()[0]["device"] == "Android · Chrome (Mobile)"


@pytest.mark.asyncio
async def test_device_is_admin_only_and_never_reaches_the_public_tracker(
    client: AsyncClient,
) -> None:
    """`device` is derived from the shopper's own User-Agent, so it belongs
    with flag_reason and ip_address in the admin view -- not in the public,
    unauthenticated order tracker."""
    created = await client.post("/api/orders", json=ORDER_PAYLOAD)
    order_id = created.json()["id"]

    body = (await client.get(f"/api/orders/{order_id}")).json()

    assert "device" not in body
    assert "user_agent" not in body


@pytest.mark.asyncio
async def test_delete_order_requires_admin(
    client: AsyncClient, customer_client: AsyncClient
) -> None:
    created = await client.post("/api/orders", json=ORDER_PAYLOAD)
    order_id = created.json()["id"]

    resp = await customer_client.delete(f"/api/orders/{order_id}")

    assert resp.status_code == 403
    assert (await client.get(f"/api/orders/{order_id}")).status_code == 200


@pytest.mark.asyncio
async def test_delete_order_removes_it(
    client: AsyncClient, admin_client: AsyncClient
) -> None:
    created = await client.post("/api/orders", json=ORDER_PAYLOAD)
    order_id = created.json()["id"]

    resp = await admin_client.delete(f"/api/orders/{order_id}")

    assert resp.status_code == 204
    assert (await client.get(f"/api/orders/{order_id}")).status_code == 404


@pytest.mark.asyncio
async def test_delete_order_puts_the_stock_back(
    client: AsyncClient, admin_client: AsyncClient, db_session: AsyncSession
) -> None:
    """Creating an order decrements attrs["stock"]. Deleting it has to return
    those units -- otherwise clearing out test orders silently destroys the
    stock they reserved."""
    product = Product(
        sku="RESTOCK-1",
        slug="restock-me",
        name="Restock Me",
        price=Decimal("100.00"),
        mrp=Decimal("100.00"),
        in_stock=True,
        attrs={"stock": 5},
    )
    db_session.add(product)
    await db_session.commit()

    created = await client.post(
        "/api/orders",
        json={
            "user_id": "test-user-restock",
            "items": [{"product_id": str(product.id), "quantity": 5, "unit_price": "100.00"}],
            "terms_accepted": True,
            "terms_version": "2026-07-22",
        },
    )
    assert created.status_code == 201
    await db_session.refresh(product)
    assert product.attrs["stock"] == 0
    assert product.in_stock is False

    await admin_client.delete(f"/api/orders/{created.json()['id']}")

    await db_session.refresh(product)
    assert product.attrs["stock"] == 5
    # Reserving down to zero flipped in_stock off; restocking must flip it back
    # or deleting an order leaves the product permanently unsellable.
    assert product.in_stock is True


@pytest.mark.asyncio
async def test_delete_order_can_skip_the_restock(
    client: AsyncClient, admin_client: AsyncClient, db_session: AsyncSession
) -> None:
    product = Product(
        sku="NORESTOCK-1",
        slug="no-restock",
        name="No Restock",
        price=Decimal("100.00"),
        mrp=Decimal("100.00"),
        attrs={"stock": 4},
    )
    db_session.add(product)
    await db_session.commit()

    created = await client.post(
        "/api/orders",
        json={
            "user_id": "test-user-norestock",
            # 3 units, not 1: a 100.00 COD order is below the 200 deposit
            # floor create_order enforces, so a single unit is rejected 422.
            "items": [{"product_id": str(product.id), "quantity": 3, "unit_price": "100.00"}],
            "terms_accepted": True,
            "terms_version": "2026-07-22",
        },
    )

    assert created.status_code == 201, created.text
    await admin_client.delete(f"/api/orders/{created.json()['id']}?restock=false")

    await db_session.refresh(product)
    # 4 - 3 reserved = 1, and the skipped restock leaves it there.
    assert product.attrs["stock"] == 1


@pytest.mark.asyncio
async def test_delete_refuses_a_paid_order(
    client: AsyncClient, admin_client: AsyncClient
) -> None:
    """A paid order is a financial record. Deleting it would destroy the only
    trace that money was taken, so it is refused with an explanation rather
    than silently allowed."""
    created = await client.post("/api/orders", json=ORDER_PAYLOAD)
    order_id = created.json()["id"]
    paid = await admin_client.patch(f"/api/orders/{order_id}/payment?payment_status=paid")
    assert paid.status_code == 200

    resp = await admin_client.delete(f"/api/orders/{order_id}")

    assert resp.status_code == 409
    assert "refund" in resp.json()["detail"].lower()
    assert (await client.get(f"/api/orders/{order_id}")).status_code == 200


@pytest.mark.asyncio
async def test_delete_unknown_order_is_404(admin_client: AsyncClient) -> None:
    resp = await admin_client.delete(f"/api/orders/{uuid.uuid4()}")
    assert resp.status_code == 404


# ---- Support search: find an order from what a customer actually quotes ----


# Field names must match schemas/auth.py Address exactly -- Pydantic drops
# anything it does not know, so a typo here silently stores a blank address.
ADDRESS = {
    "full_name": "Praveen Kumar",
    "phone": "9738281596",
    "line1": "12 MG Road",
    "city": "Bangalore",
    "state": "Karnataka",
    "postcode": "560025",
    "country": "India",
}


async def _place_searchable_order(client: AsyncClient, user_id: str) -> str:
    payload = {**ORDER_PAYLOAD, "user_id": user_id, "shipping_address": ADDRESS}
    created = await client.post("/api/orders", json=payload)
    assert created.status_code == 201, created.text
    return created.json()["id"]


@pytest.mark.asyncio
async def test_search_finds_an_order_by_tracking_number(
    client: AsyncClient, admin_client: AsyncClient
) -> None:
    """The AWB is what a customer quotes from the courier's SMS -- usually the
    only reference they have, since they never see an internal order id."""
    order_id = await _place_searchable_order(client, "shopper-a@example.com")
    await _place_searchable_order(client, "shopper-b@example.com")
    await admin_client.patch(
        f"/api/orders/{order_id}/shipping?courier=Delhivery&tracking_number=AWB123456789"
    )

    found = await admin_client.get("/api/orders/all?q=AWB123456789")

    assert found.status_code == 200
    assert [o["id"] for o in found.json()] == [order_id]


@pytest.mark.asyncio
async def test_search_by_courier_name_is_case_insensitive(
    client: AsyncClient, admin_client: AsyncClient
) -> None:
    order_id = await _place_searchable_order(client, "shopper-a@example.com")
    await admin_client.patch(
        f"/api/orders/{order_id}/shipping?courier=Delhivery&tracking_number=AWB1"
    )

    found = await admin_client.get("/api/orders/all?q=delhiv")

    assert [o["id"] for o in found.json()] == [order_id]


@pytest.mark.asyncio
async def test_search_finds_a_guest_order_by_email(
    client: AsyncClient, admin_client: AsyncClient
) -> None:
    order_id = await _place_searchable_order(client, "praveen9705@gmail.com")
    await _place_searchable_order(client, "someone-else@example.com")

    found = await admin_client.get("/api/orders/all?q=praveen9705")

    assert [o["id"] for o in found.json()] == [order_id]


@pytest.mark.asyncio
async def test_search_finds_an_order_by_phone_number(
    client: AsyncClient, admin_client: AsyncClient
) -> None:
    """Phone lives inside the shipping-address JSON snapshot, which has no
    column of its own -- support asks for it constantly."""
    order_id = await _place_searchable_order(client, "shopper-a@example.com")

    found = await admin_client.get("/api/orders/all?q=9738281596")

    assert [o["id"] for o in found.json()] == [order_id]


@pytest.mark.asyncio
async def test_search_finds_an_order_by_pincode_and_name(
    client: AsyncClient, admin_client: AsyncClient
) -> None:
    order_id = await _place_searchable_order(client, "shopper-a@example.com")

    by_pincode = await admin_client.get("/api/orders/all?q=560025")
    by_street = await admin_client.get("/api/orders/all?q=MG Road")
    by_name = await admin_client.get("/api/orders/all?q=Praveen")

    assert [o["id"] for o in by_pincode.json()] == [order_id]
    assert [o["id"] for o in by_street.json()] == [order_id]
    # Recipient name: a courier will not accept a shipment without one, and
    # support searches by it constantly.
    assert [o["id"] for o in by_name.json()] == [order_id]


@pytest.mark.asyncio
async def test_search_by_partial_order_id(
    client: AsyncClient, admin_client: AsyncClient
) -> None:
    """The console displays only the first 8 characters, so that prefix is
    what an admin can actually copy out of the table."""
    order_id = await _place_searchable_order(client, "shopper-a@example.com")
    await _place_searchable_order(client, "shopper-b@example.com")

    found = await admin_client.get(f"/api/orders/all?q={order_id[:8]}")

    assert order_id in [o["id"] for o in found.json()]


@pytest.mark.asyncio
async def test_search_finds_a_registered_customers_order_by_their_account_email(
    client: AsyncClient, admin_client: AsyncClient, customer_user
) -> None:
    """A signed-in customer's order stores their account UUID, not their email,
    so this one only works by joining through the users table."""
    order_id = await _place_searchable_order(client, str(customer_user.id))

    found = await admin_client.get(f"/api/orders/all?q={customer_user.email}")

    assert [o["id"] for o in found.json()] == [order_id]


@pytest.mark.asyncio
async def test_search_with_no_match_returns_empty_not_everything(
    client: AsyncClient, admin_client: AsyncClient
) -> None:
    """The failure that matters: a query that matches nothing must not fall
    back to listing every order, or support would act on the wrong one."""
    await _place_searchable_order(client, "shopper-a@example.com")

    found = await admin_client.get("/api/orders/all?q=NOSUCHTHING999")

    assert found.json() == []


@pytest.mark.asyncio
async def test_blank_search_still_lists_everything(
    client: AsyncClient, admin_client: AsyncClient
) -> None:
    await _place_searchable_order(client, "shopper-a@example.com")
    await _place_searchable_order(client, "shopper-b@example.com")

    assert len((await admin_client.get("/api/orders/all")).json()) == 2
    assert len((await admin_client.get("/api/orders/all?q=")).json()) == 2
    assert len((await admin_client.get("/api/orders/all?q=%20%20")).json()) == 2


@pytest.mark.asyncio
async def test_search_is_admin_only(customer_client: AsyncClient) -> None:
    assert (await customer_client.get("/api/orders/all?q=anything")).status_code == 403


# ---- Stock release: every exit from an order returns its units exactly once ----


async def _product_with_stock(db_session: AsyncSession, sku: str, stock: int) -> Product:
    product = Product(
        sku=sku,
        slug=sku.lower(),
        name=f"Stocked {sku}",
        price=Decimal("300.00"),
        mrp=Decimal("300.00"),
        in_stock=True,
        attrs={"stock": stock},
    )
    db_session.add(product)
    await db_session.commit()
    return product


async def _order_for(client: AsyncClient, product: Product, qty: int) -> str:
    resp = await client.post(
        "/api/orders",
        json={
            "user_id": "stock-test@example.com",
            "items": [
                {"product_id": str(product.id), "quantity": qty, "unit_price": "300.00"}
            ],
            "terms_accepted": True,
            "terms_version": "2026-07-22",
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_cancelling_an_order_returns_its_stock(
    client: AsyncClient, admin_client: AsyncClient, db_session: AsyncSession
) -> None:
    """Cancelling used to change a word and nothing else.

    Placing the order reserved the units; cancelling left them reserved
    forever, so every cancellation permanently removed sellable stock the shop
    still physically owned.
    """
    product = await _product_with_stock(db_session, "CANCEL-1", 10)
    order_id = await _order_for(client, product, 3)
    await db_session.refresh(product)
    assert product.attrs["stock"] == 7

    resp = await admin_client.patch(f"/api/orders/{order_id}/status?status=cancelled")

    assert resp.status_code == 200
    await db_session.refresh(product)
    assert product.attrs["stock"] == 10


@pytest.mark.asyncio
async def test_cancelling_twice_does_not_restock_twice(
    client: AsyncClient, admin_client: AsyncClient, db_session: AsyncSession
) -> None:
    """Idempotence is the whole point of tracking release as state rather than
    reacting to a status transition — a double click must not invent stock."""
    product = await _product_with_stock(db_session, "CANCEL-2", 10)
    order_id = await _order_for(client, product, 4)

    await admin_client.patch(f"/api/orders/{order_id}/status?status=cancelled")
    await admin_client.patch(f"/api/orders/{order_id}/status?status=cancelled")

    await db_session.refresh(product)
    assert product.attrs["stock"] == 10


@pytest.mark.asyncio
async def test_deleting_a_cancelled_order_does_not_restock_twice(
    client: AsyncClient, admin_client: AsyncClient, db_session: AsyncSession
) -> None:
    """The two fixes have to agree with each other. Cancelling releases the
    stock; deleting the same order afterwards must not release it again."""
    product = await _product_with_stock(db_session, "CANCEL-3", 10)
    order_id = await _order_for(client, product, 5)

    await admin_client.patch(f"/api/orders/{order_id}/status?status=cancelled")
    await admin_client.delete(f"/api/orders/{order_id}")

    await db_session.refresh(product)
    assert product.attrs["stock"] == 10


@pytest.mark.asyncio
async def test_deleting_a_returned_order_does_not_restock_twice(
    client: AsyncClient, admin_client: AsyncClient, db_session: AsyncSession
) -> None:
    """Approving a return already restocks and sets the order to returned.
    Deleting that order afterwards must not add the units a second time — a
    double-restock that was reachable before stock release became a flag."""
    product = await _product_with_stock(db_session, "RETURN-1", 10)
    order_id = await _order_for(client, product, 2)
    # A return can only be raised against a delivered order.
    await admin_client.patch(f"/api/orders/{order_id}/status?status=delivered")
    created = await client.post(
        "/api/returns", json={"order_id": order_id, "reason": "Damaged in transit"}
    )
    assert created.status_code == 201, created.text
    approved = await admin_client.patch(
        f"/api/returns/{created.json()['id']}?status=approved"
    )
    assert approved.status_code == 200
    await db_session.refresh(product)
    assert product.attrs["stock"] == 10

    await admin_client.delete(f"/api/orders/{order_id}")

    await db_session.refresh(product)
    assert product.attrs["stock"] == 10


@pytest.mark.asyncio
async def test_reinstating_a_cancelled_order_takes_the_stock_back(
    client: AsyncClient, admin_client: AsyncClient, db_session: AsyncSession
) -> None:
    """Cancelling by mistake and putting the order back must re-reserve, or the
    shop would be counting units it has already promised to someone."""
    product = await _product_with_stock(db_session, "REINSTATE-1", 10)
    order_id = await _order_for(client, product, 6)

    await admin_client.patch(f"/api/orders/{order_id}/status?status=cancelled")
    await db_session.refresh(product)
    assert product.attrs["stock"] == 10

    resp = await admin_client.patch(f"/api/orders/{order_id}/status?status=confirmed")

    assert resp.status_code == 200
    await db_session.refresh(product)
    assert product.attrs["stock"] == 4


@pytest.mark.asyncio
async def test_reinstating_is_refused_when_the_stock_is_gone(
    client: AsyncClient, admin_client: AsyncClient, db_session: AsyncSession
) -> None:
    """The units freed by a cancellation can be sold to someone else in the
    meantime. Reinstating then has to fail loudly rather than push stock
    negative and oversell."""
    product = await _product_with_stock(db_session, "REINSTATE-2", 5)
    order_id = await _order_for(client, product, 5)
    await admin_client.patch(f"/api/orders/{order_id}/status?status=cancelled")
    # Someone else buys the freed units.
    await _order_for(client, product, 5)
    await db_session.refresh(product)
    assert product.attrs["stock"] == 0

    resp = await admin_client.patch(f"/api/orders/{order_id}/status?status=confirmed")

    assert resp.status_code == 409
    assert "stock" in resp.json()["detail"].lower()
    await db_session.refresh(product)
    assert product.attrs["stock"] == 0


@pytest.mark.asyncio
async def test_untracked_products_are_unaffected_by_cancellation(
    client: AsyncClient, admin_client: AsyncClient, db_session: AsyncSession
) -> None:
    """Most of the seeded catalogue has no numeric stock at all. Those are
    unlimited, and a cancellation must not invent a stock number for them."""
    product = Product(
        sku="UNTRACKED-1",
        slug="untracked-1",
        name="Untracked",
        price=Decimal("300.00"),
        mrp=Decimal("300.00"),
        in_stock=True,
        attrs={},
    )
    db_session.add(product)
    await db_session.commit()
    order_id = await _order_for(client, product, 2)

    resp = await admin_client.patch(f"/api/orders/{order_id}/status?status=cancelled")

    assert resp.status_code == 200
    await db_session.refresh(product)
    assert "stock" not in (product.attrs or {})
