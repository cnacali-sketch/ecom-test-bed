"""Every admin action that should leave a trace, leaves one.

The chain tests prove the log cannot be edited. These prove there is something
in it to edit — which is the failure that actually happened here: the table
shipped, and seven routers never called it, so a price change or a discount
code appearing out of nowhere was untraceable while the console displayed an
"Activity" screen implying otherwise.

Each test asserts the row exists and that it says something a person could act
on. A row that records only "product changed" would pass a weaker test and be
useless at 11pm.
"""
import io

import pytest
from httpx import AsyncClient
from PIL import Image
from sqlalchemy import select

from app.models.audit_log import AuditLog
from app.models.error_log import ErrorLog

PRODUCT = {
    "sku": "AUDIT-SKU-01",
    "slug": "audit-product",
    "name": "Audited Product",
    "price": "299.00",
    "mrp": "399.00",
    "in_stock": True,
    "description": "A product.",
    "images": [],
    "attrs": {"stock": 5},
    "variants": [],
}

COUPON = {
    "code": "AUDIT10",
    "discount_type": "percent",
    "value": "10.00",
    "min_order_value": "0.00",
    "usage_limit": None,
    "expires_at": None,
}


async def _entries(db, action_prefix: str | None = None) -> list[AuditLog]:
    query = select(AuditLog).order_by(AuditLog.created_at.asc())
    if action_prefix:
        query = query.where(AuditLog.action.startswith(action_prefix))
    return list((await db.execute(query)).scalars().all())


# --------------------------------------------------------------------------
# Products — the gap that mattered most: prices
# --------------------------------------------------------------------------


async def test_creating_a_product_is_recorded(admin_client: AsyncClient, db_session):
    await admin_client.post("/api/products", json=PRODUCT)

    entry = (await _entries(db_session, "product.create"))[0]
    assert entry.entity_label == "Audited Product"
    assert "299.00" in entry.summary


async def test_a_price_change_records_both_the_old_and_new_price(
    admin_client: AsyncClient, db_session
):
    """The question this whole phase exists to answer."""
    created = (await admin_client.post("/api/products", json=PRODUCT)).json()
    await admin_client.put(
        f"/api/products/{created['id']}", json={**PRODUCT, "price": "99.00"}
    )

    entry = (await _entries(db_session, "product.update"))[0]
    assert entry.changes["price"] == {"from": "299.00", "to": "99.00"}


async def test_a_stock_change_is_recorded(admin_client: AsyncClient, db_session):
    """Stock moving overnight is the other thing somebody comes here to ask about."""
    created = (await admin_client.post("/api/products", json=PRODUCT)).json()
    await admin_client.put(
        f"/api/products/{created['id']}",
        json={**PRODUCT, "attrs": {"stock": 0}},
    )

    entry = (await _entries(db_session, "product.update"))[0]
    assert entry.changes["stock"] == {"from": 5, "to": 0}


async def test_saving_a_product_unchanged_records_nothing(
    admin_client: AsyncClient, db_session
):
    """The editor sends the whole product on every save.

    Without this, opening a product and closing it writes an entry, and the
    log fills with noise until the real entries are unfindable.
    """
    created = (await admin_client.post("/api/products", json=PRODUCT)).json()
    await admin_client.put(f"/api/products/{created['id']}", json=PRODUCT)

    assert await _entries(db_session, "product.update") == []


async def test_deleting_a_product_records_what_it_was(admin_client: AsyncClient, db_session):
    """After the row is gone, the id alone answers nothing."""
    created = (await admin_client.post("/api/products", json=PRODUCT)).json()
    await admin_client.delete(f"/api/products/{created['id']}")

    entry = (await _entries(db_session, "product.delete"))[0]
    assert "Audited Product" in entry.summary
    assert entry.changes["price"]["from"] == "299.00"


async def test_a_failed_product_create_leaves_no_entry(admin_client: AsyncClient, db_session):
    """The transaction rule, end to end.

    A duplicate slug rolls the product back. The audit row shares that
    transaction, so it must roll back too — a log claiming a product was
    created when none was is worse than no log.
    """
    await admin_client.post("/api/products", json=PRODUCT)
    conflict = await admin_client.post("/api/products", json=PRODUCT)

    assert conflict.status_code == 409
    assert len(await _entries(db_session, "product.create")) == 1


# --------------------------------------------------------------------------
# Coupons — a standing instruction to charge less
# --------------------------------------------------------------------------


async def test_creating_a_coupon_is_recorded(admin_client: AsyncClient, db_session):
    await admin_client.post("/api/coupons", json=COUPON)

    entry = (await _entries(db_session, "coupon.create"))[0]
    assert entry.entity_label == "AUDIT10"


async def test_changing_a_discount_is_recorded(admin_client: AsyncClient, db_session):
    created = (await admin_client.post("/api/coupons", json=COUPON)).json()
    await admin_client.patch(f"/api/coupons/{created['id']}", json={"value": "90.00"})

    entry = (await _entries(db_session, "coupon.update"))[0]
    assert entry.changes["value"] == {"from": "10.00", "to": "90.00"}


async def test_deleting_a_coupon_is_recorded(admin_client: AsyncClient, db_session):
    created = (await admin_client.post("/api/coupons", json=COUPON)).json()
    await admin_client.delete(f"/api/coupons/{created['id']}")

    assert (await _entries(db_session, "coupon.delete"))[0].entity_label == "AUDIT10"


# --------------------------------------------------------------------------
# Everything else that was silent
# --------------------------------------------------------------------------


async def test_creating_a_category_is_recorded(admin_client: AsyncClient, db_session):
    await admin_client.post("/api/categories", json={"name": "Hair Clips"})

    assert (await _entries(db_session, "category.create"))[0].entity_label == "Hair Clips"


async def test_a_reorder_writes_one_entry_not_one_per_category(
    admin_client: AsyncClient, db_session
):
    a = (await admin_client.post("/api/categories", json={"name": "Clips"})).json()
    b = (await admin_client.post("/api/categories", json={"name": "Bands"})).json()

    await admin_client.put("/api/categories/reorder", json={"ids": [b["id"], a["id"]]})

    entries = await _entries(db_session, "category.reorder")
    assert len(entries) == 1
    assert "2 categories" in entries[0].summary


async def test_editing_the_homepage_is_recorded(admin_client: AsyncClient, db_session):
    """A full-replace endpoint: the previous value exists nowhere else."""
    await admin_client.put("/api/sections", json={"hero_headline": "New headline"})

    entry = (await _entries(db_session, "homepage.update"))[0]
    assert entry.changes["hero_headline"]["to"] == "New headline"


async def test_purging_the_error_log_records_how_much_was_destroyed(
    admin_client: AsyncClient, db_session
):
    """The one admin action that destroys evidence has to leave some.

    Seeded with a real row on purpose. Against an empty table the count is
    zero whether it is read before or after the delete, so the test would pass
    against code that reads it afterwards and always reports "Cleared 0" -- the
    exact bug that makes the entry worthless.
    """
    db_session.add(
        ErrorLog(status_code=500, method="GET", path="/boom", message="kaboom")
    )
    await db_session.commit()

    await admin_client.delete("/api/error-logs")

    entry = (await _entries(db_session, "error_log.purge"))[0]
    assert "Cleared 1 captured error" in entry.summary
    assert entry.changes["count"] == {"from": 1, "to": 0}


async def test_uploading_a_photo_is_recorded(admin_client: AsyncClient, db_session):
    """Photos are how a product is represented; a swapped one is worth tracing."""
    buf = io.BytesIO()
    Image.new("RGB", (2, 2), color="red").save(buf, format="PNG")

    await admin_client.post(
        "/api/media",
        files={"file": ("hero.png", buf.getvalue(), "image/png")},
    )

    entry = (await _entries(db_session, "media.upload"))[0]
    assert "hero.png" in entry.summary


async def test_deleting_a_photo_is_recorded(admin_client: AsyncClient, db_session):
    buf = io.BytesIO()
    Image.new("RGB", (2, 2), color="red").save(buf, format="PNG")
    created = (
        await admin_client.post(
            "/api/media", files={"file": ("gone.png", buf.getvalue(), "image/png")}
        )
    ).json()

    # Addressed by `id` -- the stored "<uuid>__<original>.png" filename -- not
    # by `name`, which is only the original filename and matches no file on disk.
    await admin_client.delete(f"/api/media/{created['id']}")

    entry = (await _entries(db_session, "media.delete"))[0]
    assert created["id"] in entry.summary
    assert "gone.png" in entry.summary


async def test_an_admin_action_records_who_did_it(admin_client: AsyncClient, db_session, admin_user):
    """Not just that something happened."""
    await admin_client.post("/api/coupons", json=COUPON)

    entry = (await _entries(db_session, "coupon.create"))[0]
    assert entry.actor_email == admin_user.email
    assert entry.actor_id == admin_user.id
    assert entry.actor_role == "admin"


async def test_every_new_entry_joins_the_chain(admin_client: AsyncClient, db_session):
    """Wiring a router must not produce entries that sit outside the chain."""
    await admin_client.post("/api/products", json=PRODUCT)
    await admin_client.post("/api/coupons", json=COUPON)
    await admin_client.post("/api/categories", json={"name": "Clips"})

    entries = await _entries(db_session)
    assert len(entries) == 3
    assert all(e.entry_hash for e in entries)
    assert [e.prev_id for e in entries[1:]] == [e.id for e in entries[:-1]]

    assert (await admin_client.get("/api/audit/verify")).json()["ok"] is True
