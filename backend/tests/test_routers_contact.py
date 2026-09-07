"""Tests for /api/contact endpoints."""
import pytest
from httpx import AsyncClient


def _contact_payload(**overrides) -> dict:
    payload = {
        "category": "query",
        "name": "Test Customer",
        "email": "test-customer@example.com",
        "message": "Where is my order?",
    }
    payload.update(overrides)
    return payload


@pytest.mark.asyncio
async def test_submit_contact_message_public(client: AsyncClient) -> None:
    resp = await client.post("/api/contact", json=_contact_payload())
    assert resp.status_code == 201
    assert resp.json()["is_read"] is False


@pytest.mark.asyncio
async def test_submit_contact_message_requires_email_or_phone(client: AsyncClient) -> None:
    resp = await client.post("/api/contact", json=_contact_payload(email=None))
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_submit_contact_message_invalid_category_422(client: AsyncClient) -> None:
    resp = await client.post("/api/contact", json=_contact_payload(category="not-a-category"))
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_submit_contact_message_with_phone_only(client: AsyncClient) -> None:
    resp = await client.post("/api/contact", json=_contact_payload(email=None, phone="9876543210"))
    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_list_contact_messages_requires_admin(client: AsyncClient) -> None:
    resp = await client.get("/api/contact")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_list_contact_messages_as_admin(admin_client: AsyncClient, client: AsyncClient) -> None:
    await client.post("/api/contact", json=_contact_payload())
    resp = await admin_client.get("/api/contact")
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


@pytest.mark.asyncio
async def test_submit_response_omits_ip_address(client: AsyncClient) -> None:
    """The submitter's own confirmation must not echo back their recorded IP."""
    resp = await client.post("/api/contact", json=_contact_payload())
    assert resp.status_code == 201
    assert "ip_address" not in resp.json()


@pytest.mark.asyncio
async def test_admin_list_still_includes_ip_address(admin_client: AsyncClient, client: AsyncClient) -> None:
    await client.post("/api/contact", json=_contact_payload())
    resp = await admin_client.get("/api/contact")
    assert resp.status_code == 200
    assert "ip_address" in resp.json()[0]


@pytest.mark.asyncio
async def test_mark_message_read_as_admin(admin_client: AsyncClient, client: AsyncClient) -> None:
    created = await client.post("/api/contact", json=_contact_payload())
    message_id = created.json()["id"]
    resp = await admin_client.patch(f"/api/contact/{message_id}?is_read=true")
    assert resp.status_code == 200
    assert resp.json()["is_read"] is True


@pytest.mark.asyncio
async def test_delete_message_as_admin(admin_client: AsyncClient, client: AsyncClient) -> None:
    created = await client.post("/api/contact", json=_contact_payload())
    message_id = created.json()["id"]
    resp = await admin_client.delete(f"/api/contact/{message_id}")
    assert resp.status_code == 204
    listed = await admin_client.get("/api/contact")
    assert all(m["id"] != message_id for m in listed.json())


@pytest.mark.asyncio
async def test_delete_message_as_customer_403(customer_client: AsyncClient, client: AsyncClient) -> None:
    created = await client.post("/api/contact", json=_contact_payload())
    message_id = created.json()["id"]
    resp = await customer_client.delete(f"/api/contact/{message_id}")
    assert resp.status_code == 403
