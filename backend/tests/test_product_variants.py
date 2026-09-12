"""Editing variants, and not losing the ones that already exist.

There are fifty variants in production across thirty products -- colours with
hex swatches and images -- and until now nothing could edit them. The admin
console has never had a variant UI: `lib/admin/adapt.ts` sends `variants: []`
on every save, and `PUT /api/products/{id}` excluded the field entirely. Those
rows survive because of that exclusion, not because anything guards them.

So the first job of this suite is the guard, not the feature. Making PUT honour
variants turns every save the old console ever made into a deletion request,
and a browser tab holding the old JavaScript keeps making them after a deploy.
"""
import uuid
from decimal import Decimal

import pytest
from httpx import AsyncClient

PRODUCT = {
    "sku": "VAR-SKU-01",
    "slug": "variant-product",
    "name": "Variant Product",
    "price": "500.00",
    "mrp": "600.00",
    "in_stock": True,
    "description": "A product with variants.",
    "images": [],
    "attrs": {},
    "variants": [
        {"sku": "VAR-TEAL", "color": "Teal", "color_hex": "#1f6f6b", "in_stock": True},
        {"sku": "VAR-GOLD", "color": "Gold", "color_hex": "#d4af37", "in_stock": True},
    ],
}


async def _create(client: AsyncClient) -> dict:
    return (await client.post("/api/products", json=PRODUCT)).json()


def _skus(product: dict) -> list[str]:
    return sorted(v["sku"] for v in product["variants"])


# --------------------------------------------------------------------------
# Not losing the fifty
# --------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_a_save_from_a_console_with_no_variant_editor_changes_nothing(
    admin_client: AsyncClient,
):
    """The exact request the live admin has been sending for months.

    If an empty list meant "delete them all", deploying this phase would wipe
    fifty variants the first time anybody edited a product's price.
    """
    created = await _create(admin_client)

    resp = await admin_client.put(
        f"/api/products/{created['id']}",
        json={**PRODUCT, "name": "Renamed", "variants": []},
    )

    assert resp.status_code == 200
    assert _skus(resp.json()) == ["VAR-GOLD", "VAR-TEAL"]


@pytest.mark.asyncio
async def test_a_save_that_omits_variants_entirely_changes_nothing(
    admin_client: AsyncClient,
):
    """A client that does not know about variants at all must not delete them."""
    created = await _create(admin_client)
    body = {k: v for k, v in PRODUCT.items() if k != "variants"}

    resp = await admin_client.put(f"/api/products/{created['id']}", json={**body, "name": "X"})

    assert _skus(resp.json()) == ["VAR-GOLD", "VAR-TEAL"]


# --------------------------------------------------------------------------
# Editing
# --------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_a_variant_can_be_added(admin_client: AsyncClient):
    created = await _create(admin_client)

    resp = await admin_client.put(
        f"/api/products/{created['id']}",
        json={
            **PRODUCT,
            "variants": PRODUCT["variants"]
            + [{"sku": "VAR-ROSE", "color": "Rose", "color_hex": "#e8b4b8", "in_stock": True}],
        },
    )

    assert _skus(resp.json()) == ["VAR-GOLD", "VAR-ROSE", "VAR-TEAL"]


@pytest.mark.asyncio
async def test_a_variant_is_removed_by_leaving_it_out_of_the_others(
    admin_client: AsyncClient,
):
    """Deletion is expressible, as long as something is left behind."""
    created = await _create(admin_client)

    resp = await admin_client.put(
        f"/api/products/{created['id']}", json={**PRODUCT, "variants": PRODUCT["variants"][:1]}
    )

    assert _skus(resp.json()) == ["VAR-TEAL"]


@pytest.mark.asyncio
async def test_an_existing_variant_is_edited_in_place_not_replaced(
    admin_client: AsyncClient,
):
    """Matched on SKU. Replacing the row would issue a new id, and anything
    holding the old one -- a cart, an open tab -- would quietly stop resolving."""
    created = await _create(admin_client)
    original_id = next(v["id"] for v in created["variants"] if v["sku"] == "VAR-TEAL")

    resp = await admin_client.put(
        f"/api/products/{created['id']}",
        json={
            **PRODUCT,
            "variants": [
                {"sku": "VAR-TEAL", "color": "Deep Teal", "color_hex": "#14514e", "in_stock": False},
                PRODUCT["variants"][1],
            ],
        },
    )

    teal = next(v for v in resp.json()["variants"] if v["sku"] == "VAR-TEAL")
    assert teal["id"] == original_id
    assert teal["color"] == "Deep Teal"
    assert teal["in_stock"] is False


@pytest.mark.asyncio
async def test_reordering_the_list_does_not_rename_anything(admin_client: AsyncClient):
    """Matched on SKU rather than position.

    Position matching would rename every variant below a removed row -- the
    kind of corruption that looks like a UI bug and is a data one.
    """
    created = await _create(admin_client)

    resp = await admin_client.put(
        f"/api/products/{created['id']}",
        json={**PRODUCT, "variants": list(reversed(PRODUCT["variants"]))},
    )

    by_sku = {v["sku"]: v["color"] for v in resp.json()["variants"]}
    assert by_sku == {"VAR-TEAL": "Teal", "VAR-GOLD": "Gold"}


# --------------------------------------------------------------------------
# The new fields
# --------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_a_variant_can_carry_its_own_size_price_and_quantity(
    admin_client: AsyncClient,
):
    created = await _create(admin_client)

    resp = await admin_client.put(
        f"/api/products/{created['id']}",
        json={
            **PRODUCT,
            "variants": [
                {
                    "sku": "VAR-TEAL",
                    "color": "Teal",
                    "color_hex": "#1f6f6b",
                    "in_stock": True,
                    "size": "Large",
                    "price": "650.00",
                    "mrp": "800.00",
                    "stock_quantity": 12,
                },
                PRODUCT["variants"][1],
            ],
        },
    )

    teal = next(v for v in resp.json()["variants"] if v["sku"] == "VAR-TEAL")
    assert teal["size"] == "Large"
    assert teal["price"] == "650.00"
    assert teal["stock_quantity"] == 12


@pytest.mark.asyncio
async def test_the_new_fields_default_to_null_not_to_zero(admin_client: AsyncClient):
    """Null means "ask the product". Zero would mean this variant is free and
    sold out, which is what the fifty existing rows would have become."""
    created = await _create(admin_client)

    variant = created["variants"][0]
    assert variant["size"] is None
    assert variant["price"] is None
    assert variant["stock_quantity"] is None


@pytest.mark.asyncio
async def test_a_negative_price_is_refused(admin_client: AsyncClient):
    created = await _create(admin_client)

    resp = await admin_client.put(
        f"/api/products/{created['id']}",
        json={
            **PRODUCT,
            "variants": [{**PRODUCT["variants"][0], "price": "-1.00"}, PRODUCT["variants"][1]],
        },
    )

    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_a_negative_quantity_is_refused(admin_client: AsyncClient):
    created = await _create(admin_client)

    resp = await admin_client.put(
        f"/api/products/{created['id']}",
        json={
            **PRODUCT,
            "variants": [
                {**PRODUCT["variants"][0], "stock_quantity": -5},
                PRODUCT["variants"][1],
            ],
        },
    )

    assert resp.status_code == 422


# --------------------------------------------------------------------------
# Traceability
# --------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_variant_changes_are_audited_by_name(admin_client: AsyncClient, db_session):
    """"variants changed" answers nothing at 11pm. Which one, and did it go or
    arrive, is the whole question."""
    from sqlalchemy import select

    from app.models.audit_log import AuditLog

    created = await _create(admin_client)
    await admin_client.put(
        f"/api/products/{created['id']}",
        json={
            **PRODUCT,
            "variants": [
                PRODUCT["variants"][0],
                {"sku": "VAR-ROSE", "color": "Rose", "color_hex": "#e8b4b8", "in_stock": True},
            ],
        },
    )

    entry = (
        await db_session.execute(
            select(AuditLog).where(AuditLog.action == "product.update")
        )
    ).scalars().first()

    assert entry is not None
    assert entry.changes["variants_added"]["to"] == ["VAR-ROSE"]
    assert entry.changes["variants_removed"]["to"] == ["VAR-GOLD"]


@pytest.mark.asyncio
async def test_a_save_that_leaves_variants_alone_writes_no_variant_entry(
    admin_client: AsyncClient, db_session
):
    """Otherwise every price edit claims it touched the variants too."""
    from sqlalchemy import select

    from app.models.audit_log import AuditLog

    created = await _create(admin_client)
    await admin_client.put(
        f"/api/products/{created['id']}", json={**PRODUCT, "price": "111.00", "variants": []}
    )

    entry = (
        await db_session.execute(select(AuditLog).where(AuditLog.action == "product.update"))
    ).scalars().first()

    assert "price" in entry.changes
    assert not any(k.startswith("variants_") for k in entry.changes)
