"""Tests for /api/collections endpoints."""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.collection import Collection


async def _create_collection(db: AsyncSession, slug: str, name: str) -> Collection:
    col = Collection(slug=slug, name=name, description=f"{name} desc")
    db.add(col)
    await db.commit()
    return col


@pytest.mark.asyncio
async def test_list_collections_empty(client: AsyncClient) -> None:
    resp = await client.get("/api/collections")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_list_collections(client: AsyncClient, db_session: AsyncSession) -> None:
    await _create_collection(db_session, "hair-accessories", "Hair Accessories")
    await _create_collection(db_session, "jewellery", "Jewellery")
    resp = await client.get("/api/collections")
    assert resp.status_code == 200
    assert len(resp.json()) == 2
    slugs = [c["slug"] for c in resp.json()]
    assert "hair-accessories" in slugs


@pytest.mark.asyncio
async def test_get_collection_by_slug(client: AsyncClient, db_session: AsyncSession) -> None:
    await _create_collection(db_session, "jewellery", "Jewellery")
    resp = await client.get("/api/collections/jewellery")
    assert resp.status_code == 200
    assert resp.json()["slug"] == "jewellery"
    assert "products" in resp.json()


@pytest.mark.asyncio
async def test_get_collection_404(client: AsyncClient) -> None:
    resp = await client.get("/api/collections/does-not-exist")
    assert resp.status_code == 404
