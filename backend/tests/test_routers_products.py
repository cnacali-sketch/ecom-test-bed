"""Integration tests for /api/products/* endpoints, backed by SQLite in-memory."""
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import Product, ProductVariant


class TestProductsRouter:
    def test_create_and_list_product(self, client: TestClient):
        create_response = client.post(
            "/api/products",
            json={"sku": "ACME-HAT-L-0001", "name": "Sun Hat", "price": 19.99, "mrp": 24.99},
        )
        assert create_response.status_code == 201
        created = create_response.json()
        assert created["sku"] == "ACME-HAT-L-0001"
        assert created["variants"] == []

        list_response = client.get("/api/products")
        assert list_response.status_code == 200
        products = list_response.json()
        assert any(p["sku"] == "ACME-HAT-L-0001" for p in products)

    def test_get_product_returns_404_when_not_found(self, client: TestClient):
        response = client.get("/api/products/00000000-0000-0000-0000-000000000000")
        assert response.status_code == 404

    def test_create_product_returns_422_on_missing_fields(self, client: TestClient):
        response = client.post("/api/products", json={"name": "Missing SKU"})
        assert response.status_code == 422

    async def test_list_products_includes_variants(
        self, client: TestClient, db_session: AsyncSession
    ) -> None:
        product = Product(sku="VAR-TEST-01", name="Test Product", price=10, mrp=15)
        product.variants.append(
            ProductVariant(
                sku="VAR-TEST-01-RED",
                name="Test Product - Red",
                price=10,
                mrp=15,
                attrs={"color": "Red"},
            )
        )
        db_session.add(product)
        await db_session.commit()
        # The test reuses the same session the endpoint runs against (see
        # conftest's dependency override), so `variants` is already resident
        # in the identity map after commit. Expire it to force a real reload,
        # otherwise this test would pass even with selectinload removed.
        db_session.expire(product, ["variants"])

        response = client.get("/api/products")
        assert response.status_code == 200
        found = next(p for p in response.json() if p["sku"] == "VAR-TEST-01")
        assert len(found["variants"]) == 1
        assert found["variants"][0]["sku"] == "VAR-TEST-01-RED"
        assert found["variants"][0]["attrs"]["color"] == "Red"

    async def test_get_product_includes_variants(
        self, client: TestClient, db_session: AsyncSession
    ) -> None:
        product = Product(sku="VAR-TEST-02", name="Test Product 2", price=20, mrp=25)
        product.variants.append(
            ProductVariant(
                sku="VAR-TEST-02-BLU",
                name="Test Product 2 - Blue",
                price=20,
                mrp=25,
                attrs={"color": "Blue"},
            )
        )
        db_session.add(product)
        await db_session.commit()
        db_session.expire(product, ["variants"])

        response = client.get(f"/api/products/{product.id}")
        assert response.status_code == 200
        body = response.json()
        assert len(body["variants"]) == 1
        assert body["variants"][0]["sku"] == "VAR-TEST-02-BLU"
