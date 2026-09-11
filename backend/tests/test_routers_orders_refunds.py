"""Payment reference and refunds — the accounting side of an order.

Three things were missing and each one broke the books in a different way:

* The Razorpay *payment* id was verified at checkout and then discarded. Only
  razorpay_order_id was kept, which is issued before payment and never appears
  on a settlement report, so a bank credit could not be tied back to the orders
  that produced it. It is also the id Razorpay's refund API takes.
* A refund was one word on payment_status — no amount, no date, no reference.
* Partial refunds had nowhere to live, so refunding part of an order forced a
  choice between "refunded" (books say the whole order came back) and "paid"
  (books say none of it did). Both are wrong.
"""
import uuid
from decimal import Decimal

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import Product

_PRODUCT = uuid.uuid4()

ORDER = {
    "user_id": "refund-test@example.com",
    "items": [{"product_id": str(_PRODUCT), "quantity": 1, "unit_price": "1000.00"}],
    "terms_accepted": True,
    "terms_version": "2026-07-22",
}


@pytest_asyncio.fixture(autouse=True)
async def _seed(db_session: AsyncSession) -> None:
    """Price matches ORDER exactly so the server-side price authority never
    flags these as a tampering attempt."""
    db_session.add(
        Product(
            id=_PRODUCT,
            sku="REFUND-1",
            slug="refund-test-product",
            name="Refund Test Product",
            price=Decimal("1000.00"),
            mrp=Decimal("1000.00"),
            in_stock=True,
        )
    )
    await db_session.commit()


async def _paid_order(client: AsyncClient, admin_client: AsyncClient) -> tuple[str, Decimal]:
    created = await client.post("/api/orders", json=ORDER)
    assert created.status_code == 201, created.text
    order_id = created.json()["id"]
    total = Decimal(created.json()["total_amount"])
    paid = await admin_client.patch(f"/api/orders/{order_id}/payment?payment_status=paid")
    assert paid.status_code == 200
    return order_id, total


async def _admin_view(admin_client: AsyncClient, order_id: str) -> dict:
    listed = await admin_client.get("/api/orders/all")
    return next(o for o in listed.json() if o["id"] == order_id)


@pytest.mark.asyncio
async def test_verifying_a_payment_stores_the_payment_id(
    client: AsyncClient, admin_client: AsyncClient, db_session: AsyncSession, monkeypatch
) -> None:
    """Verification proved the money moved and then threw away the only
    reference to it."""
    import app.routers.orders as orders_module
    from sqlalchemy import select

    from app.models.order import Order

    monkeypatch.setattr(orders_module, "verify_payment_signature", lambda *_: True)

    created = await client.post("/api/orders", json={**ORDER, "payment_method": "prepaid"})
    order_id = created.json()["id"]

    # /razorpay/init issues this in production; set it directly so the test
    # covers verification rather than the call out to Razorpay.
    row = await db_session.execute(select(Order).where(Order.id == uuid.UUID(order_id)))
    order = row.scalar_one()
    order.razorpay_order_id = "order_RZP123"
    await db_session.commit()

    resp = await client.post(
        f"/api/orders/{order_id}/razorpay/verify",
        json={
            "razorpay_order_id": "order_RZP123",
            "razorpay_payment_id": "pay_RZP456",
            "razorpay_signature": "signature",
        },
    )

    assert resp.status_code == 200, resp.text
    assert (await _admin_view(admin_client, order_id))["razorpay_payment_id"] == "pay_RZP456"


@pytest.mark.asyncio
async def test_refund_records_amount_date_and_reference(
    client: AsyncClient, admin_client: AsyncClient
) -> None:
    order_id, _ = await _paid_order(client, admin_client)

    resp = await admin_client.post(
        f"/api/orders/{order_id}/refund",
        json={"amount": "449.00", "reference": "rfnd_ABC123"},
    )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert Decimal(body["refund_amount"]) == Decimal("449.00")
    assert body["refund_reference"] == "rfnd_ABC123"
    assert body["refunded_at"] is not None


@pytest.mark.asyncio
async def test_partial_refund_is_its_own_payment_status(
    client: AsyncClient, admin_client: AsyncClient
) -> None:
    order_id, total = await _paid_order(client, admin_client)

    resp = await admin_client.post(
        f"/api/orders/{order_id}/refund", json={"amount": "100.00"}
    )

    assert resp.json()["payment_status"] == "partially_refunded"
    assert Decimal(resp.json()["refund_amount"]) == Decimal("100.00")
    # Refunding does not rewrite what the order was worth.
    assert Decimal(resp.json()["total_amount"]) == total


@pytest.mark.asyncio
async def test_refunds_accumulate_and_close_out_the_order(
    client: AsyncClient, admin_client: AsyncClient
) -> None:
    order_id, total = await _paid_order(client, admin_client)

    await admin_client.post(f"/api/orders/{order_id}/refund", json={"amount": "100.00"})
    final = await admin_client.post(
        f"/api/orders/{order_id}/refund",
        json={"amount": str(total - Decimal("100.00"))},
    )

    assert Decimal(final.json()["refund_amount"]) == total
    # Fully refunded in two goes is still fully refunded.
    assert final.json()["payment_status"] == "refunded"


@pytest.mark.asyncio
async def test_cannot_refund_more_than_the_order_was_worth(
    client: AsyncClient, admin_client: AsyncClient
) -> None:
    order_id, total = await _paid_order(client, admin_client)

    resp = await admin_client.post(
        f"/api/orders/{order_id}/refund", json={"amount": str(total + Decimal("1.00"))}
    )

    assert resp.status_code == 422
    assert "refund" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_cannot_over_refund_across_several_partials(
    client: AsyncClient, admin_client: AsyncClient
) -> None:
    """Each refund is checked against what is left, not against the total, so
    a series of small refunds cannot exceed the order between them."""
    order_id, total = await _paid_order(client, admin_client)
    await admin_client.post(f"/api/orders/{order_id}/refund", json={"amount": str(total)})

    resp = await admin_client.post(f"/api/orders/{order_id}/refund", json={"amount": "1.00"})

    assert resp.status_code == 422
    assert Decimal((await _admin_view(admin_client, order_id))["refund_amount"]) == total


@pytest.mark.asyncio
async def test_cannot_refund_an_order_that_was_never_paid(
    client: AsyncClient, admin_client: AsyncClient
) -> None:
    """A COD order where the cash was never collected has nothing to give
    back; recording a refund would invent an outgoing payment."""
    created = await client.post("/api/orders", json=ORDER)
    order_id = created.json()["id"]

    resp = await admin_client.post(
        f"/api/orders/{order_id}/refund", json={"amount": "100.00"}
    )

    assert resp.status_code == 409
    assert "paid" in resp.json()["detail"].lower()


@pytest.mark.asyncio
@pytest.mark.parametrize("amount", ["0.00", "-50.00"])
async def test_refund_amount_must_be_positive(
    client: AsyncClient, admin_client: AsyncClient, amount: str
) -> None:
    order_id, _ = await _paid_order(client, admin_client)

    resp = await admin_client.post(
        f"/api/orders/{order_id}/refund", json={"amount": amount}
    )

    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_refund_requires_admin(
    client: AsyncClient, admin_client: AsyncClient, customer_client: AsyncClient
) -> None:
    order_id, _ = await _paid_order(client, admin_client)

    resp = await customer_client.post(
        f"/api/orders/{order_id}/refund", json={"amount": "10.00"}
    )

    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_marking_refunded_by_hand_records_the_full_amount(
    client: AsyncClient, admin_client: AsyncClient
) -> None:
    """The existing payment dropdown still works, and now leaves the books
    agreeing with it instead of saying "refunded" with nothing refunded."""
    order_id, total = await _paid_order(client, admin_client)

    resp = await admin_client.patch(
        f"/api/orders/{order_id}/payment?payment_status=refunded"
    )

    assert Decimal(resp.json()["refund_amount"]) == total
    assert resp.json()["refunded_at"] is not None


@pytest.mark.asyncio
async def test_refund_details_stay_out_of_the_public_tracker(
    client: AsyncClient, admin_client: AsyncClient
) -> None:
    """A customer may see that their order was refunded. Our payment id and
    refund reference are internal accounting records, not theirs."""
    order_id, _ = await _paid_order(client, admin_client)
    await admin_client.post(
        f"/api/orders/{order_id}/refund",
        json={"amount": "100.00", "reference": "rfnd_INTERNAL"},
    )

    public = (await client.get(f"/api/orders/{order_id}")).json()

    assert "razorpay_payment_id" not in public
    assert "refund_reference" not in public
    # The customer-facing facts are fine to show.
    assert public["payment_status"] == "partially_refunded"
