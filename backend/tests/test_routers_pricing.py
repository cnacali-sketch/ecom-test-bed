"""Integration tests for /api/pricing/* endpoints.

Internal back-office tooling -- admin-gated (see pricing.py's router-level
require_admin dependency), so these use admin_client/client/customer_client
(async, DB-backed) rather than the plain sync_client other no-DB routers use.
"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_pricing_requires_admin(client: AsyncClient) -> None:
    resp = await client.post("/api/pricing/markup", json={"cost": 50.0, "margin_pct": 20.0})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_pricing_rejects_non_admin(customer_client: AsyncClient) -> None:
    resp = await customer_client.post("/api/pricing/markup", json={"cost": 50.0, "margin_pct": 20.0})
    assert resp.status_code == 403


class TestMarkupEndpoint:
    @pytest.mark.asyncio
    async def test_returns_computed_price(self, admin_client: AsyncClient) -> None:
        resp = await admin_client.post("/api/pricing/markup", json={"cost": 50.0, "margin_pct": 20.0})
        assert resp.status_code == 200
        assert float(resp.json()["price"]) == pytest.approx(60.0)

    @pytest.mark.asyncio
    async def test_returns_422_on_zero_cost(self, admin_client: AsyncClient) -> None:
        resp = await admin_client.post("/api/pricing/markup", json={"cost": 0.0, "margin_pct": 20.0})
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_returns_422_on_missing_field(self, admin_client: AsyncClient) -> None:
        resp = await admin_client.post("/api/pricing/markup", json={"cost": 50.0})
        assert resp.status_code == 422


class TestMarginEndpoint:
    @pytest.mark.asyncio
    async def test_returns_computed_margin(self, admin_client: AsyncClient) -> None:
        resp = await admin_client.post("/api/pricing/margin", json={"cost": 50.0, "price": 100.0})
        assert resp.status_code == 200
        assert float(resp.json()["margin_pct"]) == pytest.approx(50.0)

    @pytest.mark.asyncio
    async def test_returns_422_on_zero_price(self, admin_client: AsyncClient) -> None:
        resp = await admin_client.post("/api/pricing/margin", json={"cost": 50.0, "price": 0.0})
        assert resp.status_code == 422


class TestBreakEvenEndpoint:
    @pytest.mark.asyncio
    async def test_returns_computed_units(self, admin_client: AsyncClient) -> None:
        resp = await admin_client.post(
            "/api/pricing/break-even",
            json={"fixed_costs": 1000.0, "price": 50.0, "variable_cost": 30.0},
        )
        assert resp.status_code == 200
        assert float(resp.json()["break_even"]) == pytest.approx(50.0)

    @pytest.mark.asyncio
    async def test_returns_422_when_variable_cost_exceeds_price(self, admin_client: AsyncClient) -> None:
        resp = await admin_client.post(
            "/api/pricing/break-even",
            json={"fixed_costs": 1000.0, "price": 20.0, "variable_cost": 30.0},
        )
        assert resp.status_code == 422
