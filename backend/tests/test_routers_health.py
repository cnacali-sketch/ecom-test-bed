"""Integration tests for GET /health."""
from fastapi.testclient import TestClient


class TestHealthRouter:
    def test_health_returns_200(self, client: TestClient):
        # Act
        response = client.get("/health")

        # Assert
        assert response.status_code == 200

    def test_health_returns_status_ok(self, client: TestClient):
        # Act
        response = client.get("/health")

        # Assert
        assert response.json() == {"status": "ok"}
