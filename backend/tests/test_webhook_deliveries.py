"""The record of what Razorpay sent, and the ability to run it again.

The webhook is the one money path that runs with nobody watching, and it kept
no record of running. The case that matters most is the one that is hardest to
test and easiest to get wrong: a delivery whose processing *raises* must still
leave a row behind. A log written in the same transaction as the work
disappears with it, which is precisely the silence this exists to end.
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
from app.models.audit_log import AuditLog
from app.models.order import Order
from app.models.product import Product
from app.models.webhook_delivery import WebhookDelivery
from app.routers import payments
from app.services import login_throttle, webhook_log
from tests.test_routers_orders import ADDRESS

WEBHOOK_SECRET = "test-webhook-secret"
_PRODUCT = uuid.uuid4()


@pytest.fixture(autouse=True)
def _webhook_secret(monkeypatch: pytest.MonkeyPatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "razorpay_webhook_secret", WEBHOOK_SECRET, raising=False)
    yield


@pytest_asyncio.fixture(autouse=True)
async def _seed(db_session: AsyncSession) -> None:
    db_session.add(
        Product(
            id=_PRODUCT,
            sku="WHLOG-1",
            slug="webhook-log-product",
            name="Webhook Log Product",
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
                    "id": "pay_WHLOG123",
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
            "user_id": "whlog@example.com",
            "items": [{"product_id": str(_PRODUCT), "quantity": 1, "unit_price": "1000.00"}],
            "payment_method": method,
            "shipping_address": ADDRESS,
            "terms_accepted": True,
            "terms_version": "2026-07-22",
        },
    )
    assert created.status_code == 201, created.text
    return created.json()["id"]


async def _deliveries(db: AsyncSession) -> list[WebhookDelivery]:
    db.expire_all()
    return list(
        (await db.execute(select(WebhookDelivery).order_by(WebhookDelivery.received_at)))
        .scalars()
        .all()
    )


# ---- the point of the whole feature ----

@pytest.mark.asyncio
async def test_a_delivery_that_raises_still_leaves_a_record(
    client: AsyncClient, db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """This is the entire reason the table exists.

    `payment_status` was varchar(16) while the refund handler wrote
    "partially_refunded". Every refund webhook would have raised, returned 500,
    been retried until Razorpay gave up, and left nothing at all -- a refund
    that existed at Razorpay and nowhere here.

    The failure mode being guarded is subtle: if the delivery row were written
    in the same transaction as the order change, the rollback that follows the
    exception would take the record with it, and this test would see zero rows.
    """
    order_id = await _order(client)

    async def explode(*args, **kwargs):
        raise RuntimeError("value too long for type character varying(16)")

    monkeypatch.setattr(payments, "apply_event", explode)
    raw, headers = _signed(_event("refund.processed", order_id, amount_refunded=50000))

    with pytest.raises(RuntimeError):
        await client.post("/api/payments/razorpay/webhook", content=raw, headers=headers)

    rows = await _deliveries(db_session)
    assert len(rows) == 1
    assert rows[0].status == "failed"
    assert "character varying(16)" in rows[0].detail
    assert rows[0].payload["event"] == "refund.processed"


@pytest.mark.asyncio
async def test_a_processed_delivery_is_recorded_with_its_order(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    order_id = await _order(client)
    raw, headers = _signed(_event("payment.captured", order_id))

    resp = await client.post("/api/payments/razorpay/webhook", content=raw, headers=headers)

    assert resp.status_code == 200
    row = (await _deliveries(db_session))[0]
    assert row.status == "processed"
    assert row.order_id == uuid.UUID(order_id)
    assert row.signature_valid is True
    assert row.processed_at is not None


@pytest.mark.asyncio
async def test_an_ignored_delivery_says_why(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """"We never saw it" and "we saw it and there was nothing to do" look
    identical from outside and mean completely different things. Before this,
    both were a 200 and no record."""
    raw, headers = _signed({"event": "payment.failed", "payload": {}})

    await client.post("/api/payments/razorpay/webhook", content=raw, headers=headers)

    row = (await _deliveries(db_session))[0]
    assert row.status == "ignored"
    assert "unhandled event" in row.detail


@pytest.mark.asyncio
async def test_a_forged_delivery_is_recorded_but_not_its_body(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """A run of these is somebody probing the payment webhook, which is worth
    seeing. The body is not kept: it never passed the signature check, so it is
    whatever a stranger chose to send."""
    raw = json.dumps(_event("payment.captured", str(uuid.uuid4()))).encode("utf-8")

    resp = await client.post(
        "/api/payments/razorpay/webhook",
        content=raw,
        headers={"X-Razorpay-Signature": "not-the-signature"},
    )

    assert resp.status_code == 401
    row = (await _deliveries(db_session))[0]
    assert row.status == "rejected"
    assert row.signature_valid is False
    assert row.payload is None


@pytest.mark.asyncio
async def test_forged_deliveries_cannot_fill_the_table(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """This endpoint is public and unauthenticated. Recording every rejection
    without a cap would hand anyone a way to grow the table for free -- a new
    denial-of-service surface introduced by the logging itself.

    The 401 is unaffected by the cap. Being refused and being written down are
    separate things, and only the second is rate-limited.
    """
    login_throttle._attempts.clear()
    raw = json.dumps({"event": "payment.captured"}).encode("utf-8")
    headers = {"X-Razorpay-Signature": "wrong"}

    over = webhook_log.REJECT_LOG_MAX_PER_IP + 5
    for _ in range(over):
        resp = await client.post(
            "/api/payments/razorpay/webhook", content=raw, headers=headers
        )
        assert resp.status_code == 401, "every forged delivery must still be refused"

    rows = await _deliveries(db_session)
    assert len(rows) == webhook_log.REJECT_LOG_MAX_PER_IP < over


@pytest.mark.asyncio
async def test_a_body_that_is_not_json_is_recorded_as_rejected(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    raw = b"this is not json"
    signature = hmac.new(
        WEBHOOK_SECRET.encode("utf-8"), msg=raw, digestmod=hashlib.sha256
    ).hexdigest()

    resp = await client.post(
        "/api/payments/razorpay/webhook",
        content=raw,
        headers={"X-Razorpay-Signature": signature},
    )

    assert resp.status_code == 400
    row = (await _deliveries(db_session))[0]
    assert row.status == "rejected"
    assert row.signature_valid is True, "it was genuinely signed; it just was not JSON"


@pytest.mark.asyncio
async def test_the_event_id_header_is_kept_when_sent(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """It is what ties a retry to the delivery it is retrying."""
    order_id = await _order(client)
    raw, headers = _signed(_event("payment.captured", order_id))
    headers["X-Razorpay-Event-Id"] = "evt_ABC123"

    await client.post("/api/payments/razorpay/webhook", content=raw, headers=headers)

    assert (await _deliveries(db_session))[0].event_id == "evt_ABC123"


# ---- reading the log ----

@pytest.mark.asyncio
async def test_the_log_is_admin_only(client: AsyncClient) -> None:
    """Payloads name a payment id, an amount and an order."""
    assert (await client.get("/api/webhooks")).status_code == 401
    assert (await client.get(f"/api/webhooks/{uuid.uuid4()}")).status_code == 401
    assert (await client.post(f"/api/webhooks/{uuid.uuid4()}/replay")).status_code == 401


@pytest.mark.asyncio
async def test_the_list_omits_payloads_and_the_detail_view_includes_one(
    client: AsyncClient, admin_client: AsyncClient
) -> None:
    order_id = await _order(client)
    raw, headers = _signed(_event("payment.captured", order_id))
    await client.post("/api/payments/razorpay/webhook", content=raw, headers=headers)

    listed = await admin_client.get("/api/webhooks")
    assert listed.status_code == 200
    assert "payload" not in listed.json()[0]

    one = await admin_client.get(f"/api/webhooks/{listed.json()[0]['id']}")
    assert one.json()["payload"]["event"] == "payment.captured"


@pytest.mark.asyncio
async def test_an_unknown_status_filter_is_refused_not_silently_empty(
    admin_client: AsyncClient,
) -> None:
    """An empty list for a typo'd filter reads as "nothing has failed", which
    is the most dangerous wrong answer this screen can give."""
    resp = await admin_client.get("/api/webhooks?status=faild")

    assert resp.status_code == 400
    assert "faild" not in resp.json()["detail"]


# ---- replay ----

@pytest.mark.asyncio
async def test_replaying_a_failed_delivery_applies_it(
    client: AsyncClient, admin_client: AsyncClient, db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The recovery path: the bug is fixed, the delivery is run again, and the
    order finally reflects what Razorpay reported."""
    order_id = await _order(client)

    async def explode(*args, **kwargs):
        raise RuntimeError("the bug that has since been fixed")

    real_apply = payments.apply_event
    monkeypatch.setattr(payments, "apply_event", explode)
    raw, headers = _signed(_event("payment.captured", order_id))
    with pytest.raises(RuntimeError):
        await client.post("/api/payments/razorpay/webhook", content=raw, headers=headers)

    monkeypatch.setattr(payments, "apply_event", real_apply)
    delivery_id = (await _deliveries(db_session))[0].id

    resp = await admin_client.post(f"/api/webhooks/{delivery_id}/replay")

    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "processed"
    assert resp.json()["attempts"] == 2
    db_session.expire_all()
    order = await db_session.get(Order, uuid.UUID(order_id))
    assert order.payment_status == "paid"


@pytest.mark.asyncio
async def test_replaying_something_that_already_worked_changes_nothing(
    client: AsyncClient, admin_client: AsyncClient, db_session: AsyncSession
) -> None:
    """Replay has to be safe to press twice, or nobody will press it when it
    matters. The handlers are idempotent; this proves the replay path keeps
    that property rather than double-applying."""
    order_id = await _order(client)
    raw, headers = _signed(_event("refund.processed", order_id, amount_refunded=30000))
    await client.post("/api/payments/razorpay/webhook", content=raw, headers=headers)

    db_session.expire_all()
    before = (await db_session.get(Order, uuid.UUID(order_id))).refund_amount
    delivery_id = (await _deliveries(db_session))[0].id

    resp = await admin_client.post(f"/api/webhooks/{delivery_id}/replay")

    assert resp.json()["status"] == "ignored"
    db_session.expire_all()
    after = await db_session.get(Order, uuid.UUID(order_id))
    assert after.refund_amount == before == Decimal("300.00")


@pytest.mark.asyncio
async def test_a_forged_delivery_cannot_be_replayed(
    client: AsyncClient, admin_client: AsyncClient, db_session: AsyncSession
) -> None:
    """The record of an attack is worth keeping. Acting on it is not -- the
    payload never passed the signature check, so replaying would be executing
    whatever a stranger sent, at admin request."""
    raw = json.dumps(_event("payment.captured", str(uuid.uuid4()))).encode("utf-8")
    await client.post(
        "/api/payments/razorpay/webhook",
        content=raw,
        headers={"X-Razorpay-Signature": "forged"},
    )
    delivery_id = (await _deliveries(db_session))[0].id

    resp = await admin_client.post(f"/api/webhooks/{delivery_id}/replay")

    assert resp.status_code == 409
    assert "signature" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_replaying_is_attributed_to_the_admin_who_asked(
    client: AsyncClient, admin_client: AsyncClient, db_session: AsyncSession
) -> None:
    """The order change stays attributed to the webhook, because the payload is
    Razorpay's. But a human chose the moment, and the audit trail is the record
    that settles arguments about money."""
    order_id = await _order(client)
    raw, headers = _signed(_event("payment.captured", order_id))
    await client.post("/api/payments/razorpay/webhook", content=raw, headers=headers)
    delivery_id = (await _deliveries(db_session))[0].id

    await admin_client.post(f"/api/webhooks/{delivery_id}/replay")

    entries = (
        (
            await db_session.execute(
                select(AuditLog).where(AuditLog.action == "webhook.replay")
            )
        )
        .scalars()
        .all()
    )
    assert len(entries) == 1
    assert entries[0].actor_email == "admin@example.com"


@pytest.mark.asyncio
async def test_replaying_a_missing_delivery_is_404(admin_client: AsyncClient) -> None:
    resp = await admin_client.post(f"/api/webhooks/{uuid.uuid4()}/replay")

    assert resp.status_code == 404
