"""Integration tests for /api/recommendation/* endpoints."""
from fastapi.testclient import TestClient


class TestSchemaInspectorEndpoint:
    def test_returns_valid_true_for_complete_product(self, client: TestClient):
        product = {
            "name": "Wireless Headphones",
            "image": "https://example.com/headphones.jpg",
            "description": "Noise-cancelling headphones.",
            "sku": "AUDIO-HP-001",
            "offers": {"price": "199.99"},
        }
        response = client.post("/api/recommendation/schema-inspector", json={"product": product})
        assert response.status_code == 200
        assert response.json()["valid"] is True

    def test_returns_missing_required_for_incomplete_product(self, client: TestClient):
        response = client.post("/api/recommendation/schema-inspector", json={"product": {}})
        assert response.status_code == 200
        body = response.json()
        assert body["valid"] is False
        assert len(body["missing_required"]) > 0


class TestDescriptionAnalyzerEndpoint:
    def test_returns_score_for_valid_description(self, client: TestClient):
        response = client.post(
            "/api/recommendation/description-analyzer",
            json={"description": "A well made product with great features and long-lasting quality."},
        )
        assert response.status_code == 200
        assert 0 <= response.json()["score"] <= 100

    def test_returns_422_on_empty_description(self, client: TestClient):
        response = client.post("/api/recommendation/description-analyzer", json={"description": ""})
        assert response.status_code == 422
