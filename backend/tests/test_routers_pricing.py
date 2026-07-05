from fastapi.testclient import TestClient
"""Integration tests for /api/pricing/* endpoints."""
import pytest


class TestMarkupEndpoint:
    def test_returns_computed_price(self, sync_client: TestClient):
        # Act
        response = sync_client.post("/api/pricing/markup", json={"cost": 50.0, "margin_pct": 20.0})

        # Assert
        assert response.status_code == 200
        assert float(response.json()["price"]) == pytest.approx(60.0)

    def test_returns_422_on_zero_cost(self, sync_client: TestClient):
        response = sync_client.post("/api/pricing/markup", json={"cost": 0.0, "margin_pct": 20.0})
        assert response.status_code == 422

    def test_returns_422_on_missing_field(self, sync_client: TestClient):
        response = sync_client.post("/api/pricing/markup", json={"cost": 50.0})
        assert response.status_code == 422


class TestMarginEndpoint:
    def test_returns_computed_margin(self, sync_client: TestClient):
        response = sync_client.post("/api/pricing/margin", json={"cost": 50.0, "price": 100.0})
        assert response.status_code == 200
        assert float(response.json()["margin_pct"]) == pytest.approx(50.0)

    def test_returns_422_on_zero_price(self, sync_client: TestClient):
        response = sync_client.post("/api/pricing/margin", json={"cost": 50.0, "price": 0.0})
        assert response.status_code == 422


class TestBreakEvenEndpoint:
    def test_returns_computed_units(self, sync_client: TestClient):
        response = sync_client.post(
            "/api/pricing/break-even",
            json={"fixed_costs": 1000.0, "price": 50.0, "variable_cost": 30.0},
        )
        assert response.status_code == 200
        assert float(response.json()["break_even"]) == pytest.approx(50.0)

    def test_returns_422_when_variable_cost_exceeds_price(self, sync_client: TestClient):
        response = sync_client.post(
            "/api/pricing/break-even",
            json={"fixed_costs": 1000.0, "price": 20.0, "variable_cost": 30.0},
        )
        assert response.status_code == 422
