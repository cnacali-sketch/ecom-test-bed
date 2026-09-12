"""Tests for the Razorpay webhook.

This endpoint can mark an order paid and can record a refund, and until now it
was the one money path in the codebase with no tests at all. It is also the
path that runs precisely when the browser round-trip did not — the customer
paid and closed the tab — so it cannot be treated as a redundant backup.
"""
import hashlib
import hmac
import json
import uuid
from decimal import Decimal

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.order import Order
from app.models.product import Product

WEBHOOK_SECRET = "test-webhook-secret"
_PRODUCT = uuid.uuid4()


@pytest.fixture(autouse=True)
def _webhook_secret(monkeypatch: pytest.MonkeyPatch):
    """verify_webhook_signature reads the secret from settings, and returns
    False outright when none is configured — so signing has to use the same
    value the app will check against."""
    settings = get_settings()
    monkeypatch.setattr(settings, "razorpay_webhook_secret", WEBHOOK_SECRET, raising=False)
    yield


@pytest_asyncio.fixture(autouse=True)
async def _seed(db_session: AsyncSession) -> None:
    db_session.add(
        Product(
            id=_PRODUCT,
            sku="WEBHOOK-1",
            slug="webhook-test-product",
            name="Webhook Test Product",
            price=Decimal("1000.00"),
            mrp=Decimal("1000.00"),
            in_stock=True,
        )
    )
    await db_session.commit()


def _signed(body: dict) -> tuple[bytes, dict]:
    raw = json.dumps(body).encode("utf-8")
    signature = hmac.new(
        WEBHOOK_SECRET.encode("utf-8"), msg=raw, digestmod=hashlib.sha256
    ).hexdigest()
    return raw, {"X-Razorpay-Signature": signature, "Content-Type": "application/json"}


def _event(event: str, order_id: str, **entity_extra) -> dict:
    return {
        "event": event,
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_WEBHOOK123",
                    "notes": {"order_id": order_id},
                    **entity_extra,
                }
            }
        },
    }


async def _order(client: AsyncClient, method: str = "prepaid") -> str:
    created = await client.post(
        "/api/orders",
        json={
            "user_id": "webhook-test@example.com",
            "items": [{"product_id": str(_PRODUCT), "quantity": 1, "unit_price": "1000.00"}],
            "payment_method": method,
            "terms_accepted": True,
            "terms_version": "2026-07-22",
        },
    )
    assert created.status_code == 201, created.text
    return created.json()["id"]


async def _reload(db_session: AsyncSession, order_id: str) -> Order:
    db_session.expire_all()
    row = await db_session.execute(select(Order).where(Order.id == uuid.UUID(order_id)))
    return row.scalar_one()


@pytest.mark.asyncio
async def test_unsigned_webhook_is_rejected(client: AsyncClient) -> None:
    """The whole trust model: anyone can POST here, so the signature is the
    only thing separating Razorpay from someone marking their own order paid."""
    order_id = await _order(client)
    body = _event("payment.captured", order_id)

    resp = await client.post("/api/payments/razorpay/webhook", json=body)

    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_webhook_with_a_forged_signature_is_rejected(client: AsyncClient) -> None:
    order_id = await _order(client)
    raw, _ = _signed(_event("payment.captured", order_id))

    resp = await client.post(
        "/api/payments/razorpay/webhook",
        content=raw,
        headers={"X-Razorpay-Signature": "deadbeef", "Content-Type": "application/json"},
    )

    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_captured_payment_marks_a_prepaid_order_paid_and_stores_the_id(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    order_id = await _order(client, "prepaid")
    raw, headers = _signed(_event("payment.captured", order_id))

    resp = await client.post("/api/payments/razorpay/webhook", content=raw, headers=headers)

    assert resp.status_code == 200
    order = await _reload(db_session, order_id)
    assert order.payment_status == "paid"
    # Without this the webhook path -- the one that runs when the customer
    # closed the tab -- left no reference to reconcile the settlement against.
    assert order.razorpay_payment_id == "pay_WEBHOOK123"


@pytest.mark.asyncio
async def test_captured_payment_on_a_cod_order_only_marks_the_deposit(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """COD collects a deposit online and the balance at the door, so a captured
    payment must not read as the whole order being paid."""
    order_id = await _order(client, "cod")
    raw, headers = _signed(_event("payment.captured", order_id))

    await client.post("/api/payments/razorpay/webhook", content=raw, headers=headers)

    order = await _reload(db_session, order_id)
    assert order.deposit_paid is True
    assert order.payment_status == "unpaid"


@pytest.mark.asyncio
async def test_refund_webhook_records_the_amount_not_just_the_word(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Razorpay reports paise. A partial refund has to land as a partial."""
    order_id = await _order(client, "prepaid")
    raw, headers = _signed(_event("payment.captured", order_id))
    await client.post("/api/payments/razorpay/webhook", content=raw, headers=headers)

    raw, headers = _signed(
        _event("refund.processed", order_id, amount_refunded=25000)  # ₹250.00
    )
    await client.post("/api/payments/razorpay/webhook", content=raw, headers=headers)

    order = await _reload(db_session, order_id)
    assert order.refund_amount == Decimal("250.00")
    assert order.payment_status == "partially_refunded"
    assert order.refunded_at is not None


@pytest.mark.asyncio
async def test_full_refund_webhook_closes_the_order_out(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    order_id = await _order(client, "prepaid")
    raw, headers = _signed(_event("payment.captured", order_id))
    await client.post("/api/payments/razorpay/webhook", content=raw, headers=headers)

    raw, headers = _signed(
        _event("refund.processed", order_id, amount_refunded=100000)  # ₹1000.00
    )
    await client.post("/api/payments/razorpay/webhook", content=raw, headers=headers)

    order = await _reload(db_session, order_id)
    assert order.refund_amount == Decimal("1000.00")
    assert order.payment_status == "refunded"


@pytest.mark.asyncio
async def test_a_repeated_refund_webhook_does_not_double_count(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Razorpay retries until it gets a 200, and amount_refunded is cumulative
    for the payment — so the value is assigned, never added."""
    order_id = await _order(client, "prepaid")
    raw, headers = _signed(_event("payment.captured", order_id))
    await client.post("/api/payments/razorpay/webhook", content=raw, headers=headers)

    raw, headers = _signed(_event("refund.processed", order_id, amount_refunded=25000))
    await client.post("/api/payments/razorpay/webhook", content=raw, headers=headers)
    await client.post("/api/payments/razorpay/webhook", content=raw, headers=headers)

    order = await _reload(db_session, order_id)
    assert order.refund_amount == Decimal("250.00")


@pytest.mark.asyncio
async def test_unknown_events_are_acknowledged_not_errored(client: AsyncClient) -> None:
    """Razorpay retries anything that is not a 2xx, so an unhandled event has
    to be acked rather than rejected or it retries forever."""
    order_id = await _order(client)
    raw, headers = _signed(_event("payment.failed", order_id))

    resp = await client.post("/api/payments/razorpay/webhook", content=raw, headers=headers)

    assert resp.status_code == 200
    assert resp.json()["ignored"] == "payment.failed"


@pytest.mark.asyncio
async def test_webhook_for_an_unknown_order_is_acknowledged(client: AsyncClient) -> None:
    raw, headers = _signed(_event("payment.captured", str(uuid.uuid4())))

    resp = await client.post("/api/payments/razorpay/webhook", content=raw, headers=headers)

    assert resp.status_code == 200
    assert resp.json()["ignored"] == "order not found"


@pytest.mark.asyncio
async def test_refund_is_never_recorded_as_more_than_the_order_was_worth(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Razorpay is authoritative about its own payment, not about our order.

    A COD order collects a deposit online and the balance at the door, so the
    payment Razorpay refunds can be a different figure from the order total. An
    uncapped assignment would put a refund larger than the sale into the books.
    """
    order_id = await _order(client, "prepaid")
    raw, headers = _signed(_event("payment.captured", order_id))
    await client.post("/api/payments/razorpay/webhook", content=raw, headers=headers)

    # 15,000 paise more than the 1000.00 order.
    raw, headers = _signed(_event("refund.processed", order_id, amount_refunded=115000))
    await client.post("/api/payments/razorpay/webhook", content=raw, headers=headers)

    order = await _reload(db_session, order_id)
    assert order.refund_amount == Decimal("1000.00")
    assert order.payment_status == "refunded"


@pytest.mark.asyncio
async def test_a_webhook_payment_is_logged_against_the_webhook_not_an_admin(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Money moved with nobody signed in, and the log has to say so.

    The tempting shortcut is to attribute an automated write to whichever
    admin account is at hand. That produces a log which names a real person
    next to a payment they never touched -- a confident lie in the one record
    meant to settle arguments about money.
    """
    from sqlalchemy import select

    from app.models.audit_log import AuditLog

    order_id = await _order(client, "prepaid")
    raw, headers = _signed(_event("payment.captured", order_id))

    await client.post("/api/payments/razorpay/webhook", content=raw, headers=headers)

    entry = (
        await db_session.execute(
            select(AuditLog).where(AuditLog.action.startswith("order.payment_captured"))
        )
    ).scalars().first()

    assert entry is not None, "a webhook that moved money wrote no audit entry"
    assert entry.actor_role == "system"
    assert entry.actor_id is None
    assert entry.actor_email == "razorpay@webhook"
    assert entry.changes["payment_status"]["to"] == "paid"


@pytest.mark.asyncio
async def test_a_webhook_that_changed_nothing_writes_no_audit_entry(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Razorpay retries. A redelivery of an event already applied must not
    append a second entry saying the payment was captured twice."""
    from sqlalchemy import func, select

    from app.models.audit_log import AuditLog

    order_id = await _order(client, "prepaid")
    raw, headers = _signed(_event("payment.captured", order_id))

    await client.post("/api/payments/razorpay/webhook", content=raw, headers=headers)
    await client.post("/api/payments/razorpay/webhook", content=raw, headers=headers)

    count = await db_session.scalar(
        select(func.count()).select_from(AuditLog).where(AuditLog.entity_type == "order")
    )
    assert count == 1
