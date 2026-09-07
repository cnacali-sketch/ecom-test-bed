"""Regression tests: /razorpay/verify must bind to the razorpay_order_id
issued for THIS order at /razorpay/init.

Without this binding, a signature valid for one order's payment (e.g. a
genuine Rs 1 purchase) could be replayed against ANY other order's /verify
endpoint to mark it paid for free -- the signature only proves a payment
happened, never which internal order it was for.
"""
import uuid
from decimal import Decimal

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

import app.routers.orders as orders_module
from app.models.product import Product


async def _make_prepaid_order(client: AsyncClient, db_session: AsyncSession, price: str, user_id: str) -> dict:
    product_id = uuid.uuid4()
    db_session.add(
        Product(
            id=product_id,
            sku=f"RZP-{user_id}",
            slug=f"rzp-test-{user_id}",
            name=f"Razorpay Test Item ({user_id})",
            price=Decimal(price),
            mrp=Decimal(price),
        )
    )
    await db_session.commit()
    resp = await client.post(
        "/api/orders",
        json={
            "user_id": user_id,
            "items": [{"product_id": str(product_id), "quantity": 1, "unit_price": price}],
            "terms_accepted": True,
            "terms_version": "2026-07-22",
            "payment_method": "prepaid",
        },
    )
    assert resp.status_code == 201
    return resp.json()


async def _init_payment(client: AsyncClient, monkeypatch, order_id: str, razorpay_order_id: str) -> None:
    monkeypatch.setattr(orders_module, "razorpay_enabled", lambda: True)
    monkeypatch.setattr(
        orders_module,
        "create_razorpay_order",
        lambda total, receipt, extra_notes=None: {
            "id": razorpay_order_id,
            "amount": int(total * 100),
            "currency": "INR",
        },
    )
    resp = await client.post(f"/api/orders/{order_id}/razorpay/init")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_verify_rejects_a_signature_replayed_from_a_different_order(
    client: AsyncClient, monkeypatch, db_session: AsyncSession
) -> None:
    order_a = await _make_prepaid_order(client, db_session, "1.00", "rzp-attacker")
    order_b = await _make_prepaid_order(client, db_session, "50000.00", "rzp-victim")

    await _init_payment(client, monkeypatch, order_a["id"], razorpay_order_id="order_real_paid_for_a")
    await _init_payment(client, monkeypatch, order_b["id"], razorpay_order_id="order_real_for_b")

    # The signature genuinely verifies (this is a real, valid Razorpay
    # signature for order_a's Rs 1 payment) -- only the order_id binding can
    # stop the replay.
    monkeypatch.setattr(orders_module, "verify_payment_signature", lambda *a, **k: True)

    resp = await client.post(
        f"/api/orders/{order_b['id']}/razorpay/verify",
        json={
            "razorpay_order_id": "order_real_paid_for_a",
            "razorpay_payment_id": "pay_replayed",
            "razorpay_signature": "sig_replayed",
        },
    )
    assert resp.status_code == 400

    resp = await client.get(f"/api/orders/{order_b['id']}")
    assert resp.json()["payment_status"] == "unpaid"


@pytest.mark.asyncio
async def test_verify_succeeds_with_the_matching_razorpay_order_id(
    client: AsyncClient, monkeypatch, db_session: AsyncSession
) -> None:
    order = await _make_prepaid_order(client, db_session, "999.00", "rzp-happy-path")
    await _init_payment(client, monkeypatch, order["id"], razorpay_order_id="order_real_match")
    monkeypatch.setattr(orders_module, "verify_payment_signature", lambda *a, **k: True)

    resp = await client.post(
        f"/api/orders/{order['id']}/razorpay/verify",
        json={
            "razorpay_order_id": "order_real_match",
            "razorpay_payment_id": "pay_1",
            "razorpay_signature": "sig_1",
        },
    )
    assert resp.status_code == 200
    assert resp.json()["payment_status"] == "paid"


@pytest.mark.asyncio
async def test_verify_rejects_when_init_was_never_called(
    client: AsyncClient, monkeypatch, db_session: AsyncSession
) -> None:
    order = await _make_prepaid_order(client, db_session, "999.00", "rzp-no-init")
    monkeypatch.setattr(orders_module, "verify_payment_signature", lambda *a, **k: True)

    resp = await client.post(
        f"/api/orders/{order['id']}/razorpay/verify",
        json={
            "razorpay_order_id": "order_never_issued",
            "razorpay_payment_id": "pay_1",
            "razorpay_signature": "sig_1",
        },
    )
    assert resp.status_code == 400
