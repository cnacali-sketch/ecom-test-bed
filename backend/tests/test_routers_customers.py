"""Tests for /api/customers (admin-only customer directory)."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_customers_as_admin(admin_client: AsyncClient) -> None:
    resp = await admin_client.get("/api/customers")
    assert resp.status_code == 200
    rows = resp.json()
    # The admin fixture's own account is a registered user, so at least one row.
    assert len(rows) >= 1
    assert {"id", "email", "role", "is_verified", "created_at"} <= set(rows[0])


@pytest.mark.asyncio
async def test_list_customers_never_leaks_password_hash(admin_client: AsyncClient) -> None:
    resp = await admin_client.get("/api/customers")
    assert resp.status_code == 200
    for row in resp.json():
        assert "password_hash" not in row
        assert "password" not in row


@pytest.mark.asyncio
async def test_list_customers_unauthenticated_401(client: AsyncClient) -> None:
    resp = await client.get("/api/customers")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_list_customers_as_customer_403(customer_client: AsyncClient) -> None:
    resp = await customer_client.get("/api/customers")
    assert resp.status_code == 403
