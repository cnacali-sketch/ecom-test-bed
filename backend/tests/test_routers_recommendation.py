"""Integration tests for /api/recommendation/* endpoints.

Internal back-office tooling -- admin-gated (see recommendation.py's
router-level require_admin dependency), so these use admin_client/client/
customer_client (async, DB-backed) rather than the plain sync_client other
no-DB routers use.
"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_recommendation_requires_admin(client: AsyncClient) -> None:
    resp = await client.post("/api/recommendation/schema-inspector", json={"product": {}})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_recommendation_rejects_non_admin(customer_client: AsyncClient) -> None:
    resp = await customer_client.post("/api/recommendation/schema-inspector", json={"product": {}})
    assert resp.status_code == 403


class TestSchemaInspectorEndpoint:
    @pytest.mark.asyncio
    async def test_returns_valid_true_for_complete_product(self, admin_client: AsyncClient) -> None:
        product = {
            "name": "Wireless Headphones",
            "image": "https://example.com/headphones.jpg",
            "description": "Noise-cancelling headphones.",
            "sku": "AUDIO-HP-001",
            "offers": {"price": "199.99"},
        }
        response = await admin_client.post(
            "/api/recommendation/schema-inspector", json={"product": product}
        )
        assert response.status_code == 200
        assert response.json()["valid"] is True

    @pytest.mark.asyncio
    async def test_returns_missing_required_for_incomplete_product(
        self, admin_client: AsyncClient
    ) -> None:
        response = await admin_client.post(
            "/api/recommendation/schema-inspector", json={"product": {}}
        )
        assert response.status_code == 200
        body = response.json()
        assert body["valid"] is False
        assert len(body["missing_required"]) > 0


class TestDescriptionAnalyzerEndpoint:
    @pytest.mark.asyncio
    async def test_returns_score_for_valid_description(self, admin_client: AsyncClient) -> None:
        response = await admin_client.post(
            "/api/recommendation/description-analyzer",
            json={"description": "A well made product with great features and long-lasting quality."},
        )
        assert response.status_code == 200
        assert 0 <= response.json()["score"] <= 100

    @pytest.mark.asyncio
    async def test_returns_422_on_empty_description(self, admin_client: AsyncClient) -> None:
        response = await admin_client.post(
            "/api/recommendation/description-analyzer", json={"description": ""}
        )
        assert response.status_code == 422
