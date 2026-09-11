"""The admin action log, end to end.

The question this feature exists to answer is "who did this, and what did it
look like before". These tests ask it of every action that can cost the shop
money or destroy a record, and they check the two properties that make the
answer trustworthy:

* an action that succeeded leaves an entry naming the person who took it;
* an action that failed leaves nothing, because `record` shares the
  transaction with the change it describes.

A log that quietly misses the second property is worse than no log at all —
it reports refunds that were refused and deletions that never happened.
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
    "user_id": "audit-test@example.com",
    "items": [{"product_id": str(_PRODUCT), "quantity": 1, "unit_price": "1000.00"}],
    "terms_accepted": True,
    "terms_version": "2026-07-22",
}


@pytest_asyncio.fixture(autouse=True)
async def _seed(db_session: AsyncSession) -> None:
    db_session.add(
        Product(
            id=_PRODUCT,
            sku="AUDIT-1",
            slug="audit-test-product",
            name="Audit Test Product",
            price=Decimal("1000.00"),
            mrp=Decimal("1000.00"),
            in_stock=True,
            attrs={"stock": 10},
        )
    )
    await db_session.commit()


async def _order(client: AsyncClient) -> str:
    created = await client.post("/api/orders", json=ORDER)
    assert created.status_code == 201, created.text
    return created.json()["id"]


async def _entries(admin_client: AsyncClient, **params) -> list[dict]:
    listed = await admin_client.get("/api/audit", params=params)
    assert listed.status_code == 200, listed.text
    return listed.json()


# ---- the actions that must be recorded ----

@pytest.mark.asyncio
async def test_a_status_change_records_who_moved_it_and_from_what(
    client: AsyncClient, admin_client: AsyncClient
) -> None:
    order_id = await _order(client)
    moved = await admin_client.patch(f"/api/orders/{order_id}/status?status=shipped")
    assert moved.status_code == 200

    entry = (await _entries(admin_client, action="order.status"))[0]
    assert entry["actor_email"] == "admin@example.com"
    assert entry["actor_role"] == "admin"
    assert entry["entity_id"] == order_id
    assert entry["summary"] == "Marked as shipped"
    assert entry["changes"]["status"] == {"from": "pending", "to": "shipped"}


@pytest.mark.asyncio
async def test_a_refund_records_the_amount_as_an_exact_string(
    client: AsyncClient, admin_client: AsyncClient
) -> None:
    """Money in an audit trail must not pass through a float on the way in."""
    order_id = await _order(client)
    await admin_client.patch(f"/api/orders/{order_id}/payment?payment_status=paid")
    refunded = await admin_client.post(
        f"/api/orders/{order_id}/refund",
        json={"amount": "200.50", "reference": "rfnd_abc123"},
    )
    assert refunded.status_code == 200, refunded.text

    entry = (await _entries(admin_client, action="order.refund"))[0]
    assert entry["changes"]["refund_amount"]["to"] == "200.50"
    assert entry["changes"]["payment_status"] == {"from": "paid", "to": "partially_refunded"}
    assert "rfnd_abc123" in entry["summary"]


@pytest.mark.asyncio
async def test_a_deleted_order_leaves_the_only_record_of_itself(
    client: AsyncClient, admin_client: AsyncClient
) -> None:
    """After the delete the order is gone, so the entry has to carry enough to
    identify it — the label and the total, not just a dead id."""
    order_id = await _order(client)
    deleted = await admin_client.delete(f"/api/orders/{order_id}")
    assert deleted.status_code == 204

    assert (await admin_client.get(f"/api/orders/{order_id}")).status_code == 404

    entry = (await _entries(admin_client, action="order.delete"))[0]
    assert entry["entity_label"] == f"#{order_id[:8]}"
    assert entry["changes"]["total_amount"]["from"] == "1000.00"
    assert entry["changes"]["restocked"]["to"] is True


@pytest.mark.asyncio
async def test_blocking_a_customer_is_recorded_with_the_reason(
    admin_client: AsyncClient, customer_user
) -> None:
    blocked = await admin_client.patch(
        f"/api/customers/{customer_user.id}/block",
        json={"blocked": True, "reason": "chargeback abuse"},
    )
    assert blocked.status_code == 200, blocked.text

    entry = (await _entries(admin_client, entity_type="customer"))[0]
    assert entry["action"] == "customer.block"
    assert entry["entity_label"] == "customer@example.com"
    assert "chargeback abuse" in entry["summary"]
    assert entry["changes"]["is_blocked"] == {"from": False, "to": True}


@pytest.mark.asyncio
async def test_issuing_an_invoice_is_recorded_with_its_number(
    client: AsyncClient, admin_client: AsyncClient
) -> None:
    """The invoice number is a legal serial. Who issued which one is exactly
    what a gapless series is asked to account for."""
    order_id = await _order(client)
    await admin_client.patch(f"/api/orders/{order_id}/payment?payment_status=paid")
    issued = await admin_client.post(f"/api/orders/{order_id}/invoice")
    assert issued.status_code == 201, issued.text
    number = issued.json()["number"]

    entry = (await _entries(admin_client, entity_type="invoice"))[0]
    assert entry["action"] == "invoice.issue"
    assert entry["entity_label"] == number
    assert entry["changes"]["number"]["to"] == number


@pytest.mark.asyncio
async def test_setting_dispatch_details_is_recorded(
    client: AsyncClient, admin_client: AsyncClient
) -> None:
    order_id = await _order(client)
    shipped = await admin_client.patch(
        f"/api/orders/{order_id}/shipping?courier=Delhivery&tracking_number=AWB999"
    )
    assert shipped.status_code == 200

    entry = (await _entries(admin_client, action="order.shipping"))[0]
    assert entry["changes"]["courier"] == {"from": None, "to": "Delhivery"}
    assert entry["changes"]["tracking_number"] == {"from": None, "to": "AWB999"}


@pytest.mark.asyncio
async def test_a_bulk_status_change_records_every_order_separately(
    client: AsyncClient, admin_client: AsyncClient
) -> None:
    """One entry per order, not one per click — otherwise the history of any
    single order has a hole in it exactly where a batch touched it."""
    ids = [await _order(client), await _order(client)]
    moved = await admin_client.patch(
        "/api/orders/bulk/status", json={"order_ids": ids, "status": "confirmed"}
    )
    assert moved.status_code == 200, moved.text

    for order_id in ids:
        entries = await _entries(admin_client, entity_id=order_id)
        assert len(entries) == 1
        assert entries[0]["changes"]["status"] == {"from": "pending", "to": "confirmed"}


# ---- the property that makes it trustworthy ----

@pytest.mark.asyncio
async def test_a_refused_refund_leaves_no_entry(
    client: AsyncClient, admin_client: AsyncClient
) -> None:
    """`record` adds to the caller's session and does not commit, so a change
    that never happens cannot leave a log entry claiming it did."""
    order_id = await _order(client)
    await admin_client.patch(f"/api/orders/{order_id}/payment?payment_status=paid")
    refused = await admin_client.post(
        f"/api/orders/{order_id}/refund", json={"amount": "5000.00"}
    )
    assert refused.status_code == 422

    assert await _entries(admin_client, action="order.refund") == []


@pytest.mark.asyncio
async def test_a_refused_delete_leaves_no_entry(
    client: AsyncClient, admin_client: AsyncClient
) -> None:
    order_id = await _order(client)
    await admin_client.patch(f"/api/orders/{order_id}/payment?payment_status=paid")
    refused = await admin_client.delete(f"/api/orders/{order_id}")
    assert refused.status_code == 409

    assert await _entries(admin_client, action="order.delete") == []


# ---- reading the log ----

@pytest.mark.asyncio
async def test_the_log_reads_newest_first(
    client: AsyncClient, admin_client: AsyncClient
) -> None:
    order_id = await _order(client)
    await admin_client.patch(f"/api/orders/{order_id}/status?status=confirmed")
    await admin_client.patch(f"/api/orders/{order_id}/status?status=shipped")

    entries = await _entries(admin_client, entity_id=order_id)
    assert [e["summary"] for e in entries] == ["Marked as shipped", "Marked as confirmed"]


@pytest.mark.asyncio
async def test_action_filters_by_prefix(
    client: AsyncClient, admin_client: AsyncClient
) -> None:
    """"order" returns every order action; "order.refund" narrows to refunds."""
    order_id = await _order(client)
    await admin_client.patch(f"/api/orders/{order_id}/status?status=confirmed")
    await admin_client.patch(f"/api/orders/{order_id}/payment?payment_status=paid")

    assert len(await _entries(admin_client, action="order")) == 2
    assert len(await _entries(admin_client, action="order.payment")) == 1


@pytest.mark.asyncio
async def test_the_log_is_admin_only(
    client: AsyncClient, customer_client: AsyncClient
) -> None:
    """It names staff, customers and IPs. A signed-in shopper must not see it."""
    assert (await customer_client.get("/api/audit")).status_code == 403
    assert (await client.get("/api/audit")).status_code == 401


@pytest.mark.asyncio
async def test_an_unbounded_read_is_refused(admin_client: AsyncClient) -> None:
    """This table only grows; the cap is what stops one request taking the
    console down a year from now."""
    assert (await admin_client.get("/api/audit", params={"limit": 501})).status_code == 422
    assert (await admin_client.get("/api/audit", params={"limit": 500})).status_code == 200


@pytest.mark.asyncio
async def test_there_is_no_way_to_edit_or_delete_an_entry(
    client: AsyncClient, admin_client: AsyncClient
) -> None:
    """A log the admin can quietly rewrite answers no question worth asking."""
    order_id = await _order(client)
    await admin_client.patch(f"/api/orders/{order_id}/status?status=confirmed")
    entry_id = (await _entries(admin_client))[0]["id"]

    for call in (
        admin_client.delete(f"/api/audit/{entry_id}"),
        admin_client.patch(f"/api/audit/{entry_id}", json={"summary": "nothing happened"}),
        admin_client.post("/api/audit", json={"summary": "invented"}),
    ):
        assert (await call).status_code in {404, 405}


@pytest.mark.asyncio
async def test_entries_from_one_bulk_action_still_have_an_order(
    client: AsyncClient, admin_client: AsyncClient
) -> None:
    """Timestamps are stamped in Python precisely because a database `now()`
    is one value for the whole transaction. Without that, every entry from a
    batch shares a timestamp and "newest first" degrades into an arbitrary
    order that reshuffles between reads."""
    ids = [await _order(client), await _order(client), await _order(client)]
    await admin_client.patch(
        "/api/orders/bulk/status", json={"order_ids": ids, "status": "confirmed"}
    )

    stamps = [e["created_at"] for e in await _entries(admin_client, action="order.status")]
    assert len(stamps) == 3
    assert len(set(stamps)) == 3
    assert stamps == sorted(stamps, reverse=True)
