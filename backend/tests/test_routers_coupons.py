"""Tests for /api/coupons endpoints."""
import uuid
import pytest
from httpx import AsyncClient


def _coupon_payload(**overrides) -> dict:
    payload = {
        "code": f"TEST{uuid.uuid4().hex[:6]}",
        "discount_type": "percent",
        "value": "10.00",
    }
    payload.update(overrides)
    return payload


@pytest.mark.asyncio
async def test_create_coupon_as_admin(admin_client: AsyncClient) -> None:
    resp = await admin_client.post("/api/coupons", json=_coupon_payload(code="lower-case"))
    assert resp.status_code == 201
    assert resp.json()["code"] == "LOWER-CASE"  # normalized uppercase
    assert resp.json()["times_used"] == 0


@pytest.mark.asyncio
async def test_create_coupon_unauthenticated_401(client: AsyncClient) -> None:
    resp = await client.post("/api/coupons", json=_coupon_payload())
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_create_coupon_as_customer_403(customer_client: AsyncClient) -> None:
    resp = await customer_client.post("/api/coupons", json=_coupon_payload())
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_create_coupon_duplicate_code_409(admin_client: AsyncClient) -> None:
    payload = _coupon_payload(code="DUPE10")
    first = await admin_client.post("/api/coupons", json=payload)
    assert first.status_code == 201
    second = await admin_client.post("/api/coupons", json=payload)
    assert second.status_code == 409


@pytest.mark.asyncio
async def test_create_coupon_invalid_discount_type_422(admin_client: AsyncClient) -> None:
    resp = await admin_client.post("/api/coupons", json=_coupon_payload(discount_type="bogus"))
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_coupon_percent_over_100_rejected(admin_client: AsyncClient) -> None:
    resp = await admin_client.post("/api/coupons", json=_coupon_payload(value="150"))
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_list_coupons_as_admin(admin_client: AsyncClient) -> None:
    await admin_client.post("/api/coupons", json=_coupon_payload())
    resp = await admin_client.get("/api/coupons")
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


# ---- Validation (live, checkout-facing) ----

@pytest.mark.asyncio
async def test_validate_percent_coupon(admin_client: AsyncClient) -> None:
    created = await admin_client.post("/api/coupons", json=_coupon_payload(discount_type="percent", value="10"))
    code = created.json()["code"]
    resp = await admin_client.post("/api/coupons/validate", json={"code": code, "subtotal": "1000.00"})
    assert resp.status_code == 200
    assert resp.json()["discount_amount"] == "100.00"


@pytest.mark.asyncio
async def test_validate_flat_coupon(admin_client: AsyncClient) -> None:
    created = await admin_client.post("/api/coupons", json=_coupon_payload(discount_type="flat", value="150"))
    code = created.json()["code"]
    resp = await admin_client.post("/api/coupons/validate", json={"code": code, "subtotal": "1000.00"})
    assert resp.status_code == 200
    assert resp.json()["discount_amount"] == "150.00"


@pytest.mark.asyncio
async def test_validate_flat_coupon_never_exceeds_subtotal(admin_client: AsyncClient) -> None:
    created = await admin_client.post("/api/coupons", json=_coupon_payload(discount_type="flat", value="500"))
    code = created.json()["code"]
    resp = await admin_client.post("/api/coupons/validate", json={"code": code, "subtotal": "100.00"})
    assert resp.status_code == 200
    assert resp.json()["discount_amount"] == "100.00"


@pytest.mark.asyncio
async def test_validate_unknown_code_422(client: AsyncClient) -> None:
    resp = await client.post("/api/coupons/validate", json={"code": "NOPE", "subtotal": "500.00"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_validate_below_min_order_422(admin_client: AsyncClient) -> None:
    created = await admin_client.post("/api/coupons", json=_coupon_payload(min_order_value="1000"))
    code = created.json()["code"]
    resp = await admin_client.post("/api/coupons/validate", json={"code": code, "subtotal": "500.00"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_validate_expired_coupon_422(admin_client: AsyncClient) -> None:
    created = await admin_client.post(
        "/api/coupons", json=_coupon_payload(expires_at="2020-01-01T00:00:00Z")
    )
    code = created.json()["code"]
    resp = await admin_client.post("/api/coupons/validate", json={"code": code, "subtotal": "500.00"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_validate_inactive_coupon_422(admin_client: AsyncClient) -> None:
    created = await admin_client.post("/api/coupons", json=_coupon_payload())
    coupon_id, code = created.json()["id"], created.json()["code"]
    await admin_client.patch(f"/api/coupons/{coupon_id}", json={"active": False})
    resp = await admin_client.post("/api/coupons/validate", json={"code": code, "subtotal": "500.00"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_validate_does_not_increment_times_used(admin_client: AsyncClient) -> None:
    created = await admin_client.post("/api/coupons", json=_coupon_payload())
    code = created.json()["code"]
    for _ in range(3):
        await admin_client.post("/api/coupons/validate", json={"code": code, "subtotal": "500.00"})
    listed = await admin_client.get("/api/coupons")
    match = next(c for c in listed.json() if c["code"] == code)
    assert match["times_used"] == 0


@pytest.mark.asyncio
async def test_update_coupon_usage_limit(admin_client: AsyncClient) -> None:
    created = await admin_client.post("/api/coupons", json=_coupon_payload())
    coupon_id = created.json()["id"]
    resp = await admin_client.patch(f"/api/coupons/{coupon_id}", json={"usage_limit": 5})
    assert resp.status_code == 200
    assert resp.json()["usage_limit"] == 5


@pytest.mark.asyncio
async def test_coupon_qr_returns_png(admin_client: AsyncClient) -> None:
    created = await admin_client.post("/api/coupons", json=_coupon_payload())
    coupon_id = created.json()["id"]
    resp = await admin_client.get(f"/api/coupons/{coupon_id}/qr")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "image/png"
    assert resp.content[:8] == b"\x89PNG\r\n\x1a\n"  # PNG magic bytes


@pytest.mark.asyncio
async def test_coupon_qr_requires_admin(client: AsyncClient) -> None:
    resp = await client.get(f"/api/coupons/{uuid.uuid4()}/qr")
    assert resp.status_code == 401
