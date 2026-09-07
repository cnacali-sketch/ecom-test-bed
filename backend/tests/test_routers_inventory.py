"""Integration tests for /api/inventory/* endpoints.

Internal back-office tooling -- admin-gated (see inventory.py's router-level
require_admin dependency), so these use admin_client/client/customer_client
(async, DB-backed) rather than the plain sync_client other no-DB routers use.
"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_inventory_requires_admin(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/inventory/sku", json={"brand": "nike", "category": "shoe", "size": "m", "count": 5}
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_inventory_rejects_non_admin(customer_client: AsyncClient) -> None:
    resp = await customer_client.post(
        "/api/inventory/sku", json={"brand": "nike", "category": "shoe", "size": "m", "count": 5}
    )
    assert resp.status_code == 403


class TestSkuEndpoint:
    @pytest.mark.asyncio
    async def test_returns_requested_count_of_skus(self, admin_client: AsyncClient) -> None:
        resp = await admin_client.post(
            "/api/inventory/sku",
            json={"brand": "nike", "category": "shoe", "size": "m", "count": 5},
        )
        assert resp.status_code == 200
        skus = resp.json()["skus"]
        assert len(skus) == 5
        assert skus[0] == "NIKE-SHOE-M-0001"

    @pytest.mark.asyncio
    async def test_returns_422_on_invalid_brand(self, admin_client: AsyncClient) -> None:
        resp = await admin_client.post(
            "/api/inventory/sku",
            json={"brand": "NI!KE", "category": "SHOE", "size": "M", "count": 5},
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_returns_422_on_zero_count(self, admin_client: AsyncClient) -> None:
        resp = await admin_client.post(
            "/api/inventory/sku",
            json={"brand": "NIKE", "category": "SHOE", "size": "M", "count": 0},
        )
        assert resp.status_code == 422


class TestBarcodeEndpoint:
    @pytest.mark.asyncio
    async def test_returns_png_bytes_for_ean13(self, admin_client: AsyncClient) -> None:
        resp = await admin_client.post(
            "/api/inventory/barcode",
            json={"code": "400638133393", "barcode_type": "ean13", "format": "png"},
        )
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "image/png"
        assert resp.content[:8] == b"\x89PNG\r\n\x1a\n"

    @pytest.mark.asyncio
    async def test_returns_svg_bytes_for_upca(self, admin_client: AsyncClient) -> None:
        resp = await admin_client.post(
            "/api/inventory/barcode",
            json={"code": "03600029145", "barcode_type": "upca", "format": "svg"},
        )
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "image/svg+xml"
        assert resp.content.startswith(b"<?xml")

    @pytest.mark.asyncio
    async def test_returns_422_on_invalid_code_length(self, admin_client: AsyncClient) -> None:
        resp = await admin_client.post(
            "/api/inventory/barcode",
            json={"code": "123", "barcode_type": "ean13", "format": "png"},
        )
        assert resp.status_code == 422
