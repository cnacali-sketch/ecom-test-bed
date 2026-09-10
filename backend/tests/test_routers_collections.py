"""Tests for /api/collections endpoints."""
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.collection import Collection
from app.models.product import Product, ProductVariant


async def _create_collection(db: AsyncSession, slug: str, name: str) -> Collection:
    col = Collection(slug=slug, name=name, description=f"{name} desc")
    db.add(col)
    await db.commit()
    return col


@pytest.mark.asyncio
async def test_list_collections_empty(client: AsyncClient) -> None:
    resp = await client.get("/api/collections")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_list_collections(client: AsyncClient, db_session: AsyncSession) -> None:
    await _create_collection(db_session, "hair-accessories", "Hair Accessories")
    await _create_collection(db_session, "jewellery", "Jewellery")
    resp = await client.get("/api/collections")
    assert resp.status_code == 200
    assert len(resp.json()) == 2
    slugs = [c["slug"] for c in resp.json()]
    assert "hair-accessories" in slugs


@pytest.mark.asyncio
async def test_get_collection_by_slug(client: AsyncClient, db_session: AsyncSession) -> None:
    await _create_collection(db_session, "jewellery", "Jewellery")
    resp = await client.get("/api/collections/jewellery")
    assert resp.status_code == 200
    assert resp.json()["slug"] == "jewellery"
    assert "products" in resp.json()


@pytest.mark.asyncio
async def test_get_collection_404(client: AsyncClient) -> None:
    resp = await client.get("/api/collections/does-not-exist")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_collection_returns_its_products_with_variants(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """A collection that actually contains a product must serialise.

    Regression test for a 500 that reached production. Two defects stacked:

    1. `Collection.products` was annotated `Mapped[list]` with no type
       argument, so SQLAlchemy could not infer uselist, configured the
       relationship as a scalar, and returned a single Product —
       "'Product' object is not iterable".
    2. With that fixed, `selectinload(Collection.products)` still left
       `Product.variants` unloaded, so Pydantic lazy-loaded it mid-serialise
       and hit MissingGreenlet under asyncio.

    Every pre-existing test attached zero products, so neither ever fired.
    """
    col = await _create_collection(db_session, "hair-accessories", "Hair Accessories")
    product = Product(
        sku="TEST-CLIP-1",
        slug="test-claw-clip",
        name="Test Claw Clip",
        price=Decimal("499.00"),
        mrp=Decimal("699.00"),
        in_stock=True,
    )
    product.variants.append(
        ProductVariant(sku="TEST-CLIP-1-TEAL", color="Teal", color_hex="#0d9488", in_stock=True)
    )
    product.collections.append(col)
    db_session.add(product)
    await db_session.commit()

    resp = await client.get("/api/collections/hair-accessories")

    assert resp.status_code == 200
    body = resp.json()
    assert len(body["products"]) == 1
    assert body["products"][0]["slug"] == "test-claw-clip"
    assert len(body["products"][0]["variants"]) == 1
