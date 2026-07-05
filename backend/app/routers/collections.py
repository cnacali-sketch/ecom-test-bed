from pydantic import Field
"""Collection endpoints — read-only in Phase 1.

Collections are the core navigation unit: Hair Accessories, Jewellery.
Write operations come from the seed script only; the API surfaces them
for the storefront to query.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db_session
from app.models.collection import Collection
from app.schemas.product import ProductRead

router = APIRouter(prefix="/api/collections", tags=["collections"])


class CollectionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    slug: str
    name: str
    description: str | None
    hero_image: str | None


class CollectionDetail(CollectionRead):
    products: list[ProductRead] = Field(default_factory=list)


@router.get("", response_model=list[CollectionRead])
async def list_collections(db: AsyncSession = Depends(get_db_session)) -> list[Collection]:
    """List all collections (nav/marketing metadata)."""
    result = await db.execute(select(Collection).order_by(Collection.name))
    return list(result.scalars().all())


@router.get("/{slug}", response_model=CollectionDetail)
async def get_collection(slug: str, db: AsyncSession = Depends(get_db_session)) -> CollectionDetail:
    """Return a collection with its products by slug."""
    result = await db.execute(
        select(Collection)
        .options(selectinload(Collection.products))
        .where(Collection.slug == slug)
    )
    collection = result.scalar_one_or_none()
    if collection is None:
        raise HTTPException(status_code=404, detail="Collection not found")
    # Explicitly build the response to avoid lazy-load surprises with Pydantic
    return CollectionDetail(
        slug=collection.slug,
        name=collection.name,
        description=collection.description,
        hero_image=collection.hero_image,
        products=[ProductRead.model_validate(p) for p in (collection.products or [])],
    )
