from fastapi.testclient import TestClient
"""Integration tests for /api/inventory/* endpoints."""


class TestSkuEndpoint:
    def test_returns_requested_count_of_skus(self, sync_client: TestClient):
        response = sync_client.post(
            "/api/inventory/sku",
            json={"brand": "nike", "category": "shoe", "size": "m", "count": 5},
        )
        assert response.status_code == 200
        skus = response.json()["skus"]
        assert len(skus) == 5
        assert skus[0] == "NIKE-SHOE-M-0001"

    def test_returns_422_on_invalid_brand(self, sync_client: TestClient):
        response = sync_client.post(
            "/api/inventory/sku",
            json={"brand": "NI!KE", "category": "SHOE", "size": "M", "count": 5},
        )
        assert response.status_code == 422

    def test_returns_422_on_zero_count(self, sync_client: TestClient):
        response = sync_client.post(
            "/api/inventory/sku",
            json={"brand": "NIKE", "category": "SHOE", "size": "M", "count": 0},
        )
        assert response.status_code == 422


class TestBarcodeEndpoint:
    def test_returns_png_bytes_for_ean13(self, sync_client: TestClient):
        response = sync_client.post(
            "/api/inventory/barcode",
            json={"code": "400638133393", "barcode_type": "ean13", "format": "png"},
        )
        assert response.status_code == 200
        assert response.headers["content-type"] == "image/png"
        assert response.content[:8] == b"\x89PNG\r\n\x1a\n"

    def test_returns_svg_bytes_for_upca(self, sync_client: TestClient):
        response = sync_client.post(
            "/api/inventory/barcode",
            json={"code": "03600029145", "barcode_type": "upca", "format": "svg"},
        )
        assert response.status_code == 200
        assert response.headers["content-type"] == "image/svg+xml"
        assert response.content.startswith(b"<?xml")

    def test_returns_422_on_invalid_code_length(self, sync_client: TestClient):
        response = sync_client.post(
            "/api/inventory/barcode",
            json={"code": "123", "barcode_type": "ean13", "format": "png"},
        )
        assert response.status_code == 422
