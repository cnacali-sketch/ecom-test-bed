"""Tests for /api/products endpoints.

Uses an in-memory SQLite DB via conftest. All tests are sync-friendly through
pytest-asyncio. No Postgres required.
"""
import pytest
from httpx import AsyncClient


VALID_PRODUCT = {
    "sku": "TEST-SKU-01",
    "slug": "test-product-one",
    "name": "Test Product",
    "price": "299.00",
    "mrp": "399.00",
    "in_stock": True,
    "description": "A test product.",
    "images": [],
    "attrs": {"collectionSlugs": ["hair-accessories"], "tags": []},
    "variants": [
        {"sku": "TEST-VAR-01", "color": "Teal", "color_hex": "#1f6f6b", "in_stock": True}
    ],
}


@pytest.mark.asyncio
async def test_create_product(client: AsyncClient) -> None:
    resp = await client.post("/api/products", json=VALID_PRODUCT)
    assert resp.status_code == 201
    data = resp.json()
    assert data["slug"] == "test-product-one"
    assert data["price"] == "299.00"
    assert len(data["variants"]) == 1
    assert data["variants"][0]["color"] == "Teal"


@pytest.mark.asyncio
async def test_list_products_empty(client: AsyncClient) -> None:
    resp = await client.get("/api/products")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_list_products_pagination(client: AsyncClient) -> None:
    # Create two products
    for i in range(2):
        payload = {**VALID_PRODUCT, "sku": f"PAG-{i}", "slug": f"pag-product-{i}", "variants": []}
        await client.post("/api/products", json=payload)
    resp = await client.get("/api/products?limit=1&offset=0")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


@pytest.mark.asyncio
async def test_get_by_slug(client: AsyncClient) -> None:
    await client.post("/api/products", json=VALID_PRODUCT)
    resp = await client.get("/api/products/slug/test-product-one")
    assert resp.status_code == 200
    assert resp.json()["slug"] == "test-product-one"


@pytest.mark.asyncio
async def test_get_by_slug_404(client: AsyncClient) -> None:
    resp = await client.get("/api/products/slug/does-not-exist")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_duplicate_slug_returns_409(client: AsyncClient) -> None:
    await client.post("/api/products", json=VALID_PRODUCT)
    resp = await client.post("/api/products", json=VALID_PRODUCT)
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_delete_product(client: AsyncClient) -> None:
    create = await client.post("/api/products", json=VALID_PRODUCT)
    product_id = create.json()["id"]
    resp = await client.delete(f"/api/products/{product_id}")
    assert resp.status_code == 204
    resp2 = await client.get(f"/api/products/{product_id}")
    assert resp2.status_code == 404


@pytest.mark.asyncio
async def test_collection_filter(client: AsyncClient) -> None:
    hair = {**VALID_PRODUCT, "sku": "HAIR-01", "slug": "hair-prod",
            "attrs": {"collectionSlugs": ["hair-accessories"]}, "variants": []}
    jwl = {**VALID_PRODUCT, "sku": "JWL-01", "slug": "jwl-prod",
           "attrs": {"collectionSlugs": ["jewellery"]}, "variants": []}
    await client.post("/api/products", json=hair)
    await client.post("/api/products", json=jwl)
    resp = await client.get("/api/products?collection=jewellery")
    assert resp.status_code == 200
    assert all("jewellery" in p["attrs"]["collectionSlugs"] for p in resp.json())
