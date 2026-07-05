from fastapi.testclient import TestClient
"""Integration tests for GET /health."""


class TestHealthRouter:
    def test_health_returns_200(self, sync_client: TestClient):
        # Act
        response = sync_client.get("/health")

        # Assert
        assert response.status_code == 200

    def test_health_returns_status_ok(self, sync_client: TestClient):
        # Act
        response = sync_client.get("/health")

        # Assert
        assert response.json() == {"status": "ok"}
