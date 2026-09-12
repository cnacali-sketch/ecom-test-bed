"""Category endpoints — admin-only CRUD for the product-tagging taxonomy
(see app/models/category.py for how this differs from Collection).

  GET    /api/categories       — list, ordered by sort_order (admin)
  POST   /api/categories       — create (admin)
  PATCH  /api/categories/{id}  — edit name/parent/image (admin)
  PUT    /api/categories/reorder — bulk-persist a new drag-drop order (admin)
  DELETE /api/categories/{id}  — delete (admin)
"""
import re
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db_session
from app.dependencies.auth import require_admin
from app.models.category import Category
from app.models.user import User
from app.services import audit

router = APIRouter(prefix="/api/categories", tags=["categories"], dependencies=[Depends(require_admin)])


def _audited_state(category: Category) -> dict:
    """What a category edit can actually change. `slug` is derived from the
    name, so it moves with it and is recorded to make a broken storefront link
    traceable to the rename that caused it."""
    return {
        "name": category.name,
        "slug": category.slug,
        "parent": category.parent,
        "image": category.image,
    }


def _slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    parent: str = Field(default="", max_length=100)
    image: str = Field(default="", max_length=500)


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    parent: str | None = Field(default=None, max_length=100)
    image: str | None = Field(default=None, max_length=500)


class CategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    slug: str
    parent: str
    image: str
    sort_order: int
    created_at: datetime


@router.get("", response_model=list[CategoryRead])
async def list_categories(db: AsyncSession = Depends(get_db_session)) -> list[Category]:
    result = await db.execute(select(Category).order_by(Category.sort_order, Category.created_at))
    return list(result.scalars().all())


@router.post("", response_model=CategoryRead, status_code=201)
async def create_category(
    payload: CategoryCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    actor: User = Depends(require_admin),
) -> Category:
    slug = _slugify(payload.name)
    existing = await db.execute(select(Category).where(Category.slug == slug))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="A category with this name already exists")

    max_order = await db.execute(select(Category.sort_order).order_by(Category.sort_order.desc()).limit(1))
    next_order = (max_order.scalar_one_or_none() or 0) + 1

    category = Category(name=payload.name, slug=slug, parent=payload.parent, image=payload.image, sort_order=next_order)
    db.add(category)
    await db.flush()
    await audit.record(
        db,
        actor=actor,
        request=request,
        action="category.create",
        entity_type="category",
        entity_id=category.id,
        entity_label=category.name,
        summary=f"Added category {category.name}",
    )
    await db.commit()
    await db.refresh(category)
    return category


@router.patch("/{category_id}", response_model=CategoryRead)
async def update_category(
    category_id: uuid.UUID,
    payload: CategoryUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    actor: User = Depends(require_admin),
) -> Category:
    result = await db.execute(select(Category).where(Category.id == category_id))
    category = result.scalar_one_or_none()
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")

    before = _audited_state(category)
    if payload.name is not None:
        category.name = payload.name
        category.slug = _slugify(payload.name)
    if payload.parent is not None:
        category.parent = payload.parent
    if payload.image is not None:
        category.image = payload.image

    changed = audit.diff(before, _audited_state(category))
    if changed:
        await audit.record(
            db,
            actor=actor,
            request=request,
            action="category.update",
            entity_type="category",
            entity_id=category.id,
            entity_label=category.name,
            summary=f"Edited category {category.name}",
            changes=changed,
        )
    await db.commit()
    await db.refresh(category)
    return category


class ReorderPayload(BaseModel):
    ids: list[uuid.UUID] = Field(..., min_length=1)


@router.put("/reorder", response_model=list[CategoryRead])
async def reorder_categories(
    payload: ReorderPayload,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    actor: User = Depends(require_admin),
) -> list[Category]:
    """Persist a full drag-drop reorder: `ids` is the complete new order."""
    result = await db.execute(select(Category).where(Category.id.in_(payload.ids)))
    by_id = {c.id: c for c in result.scalars().all()}
    if len(by_id) != len(payload.ids):
        raise HTTPException(status_code=422, detail="One or more category ids were not found")

    for index, cat_id in enumerate(payload.ids):
        by_id[cat_id].sort_order = index

    # One entry for the whole reorder, not one per category. A drag that moves
    # a single item shifts the sort_order of everything below it, and a log
    # that reports twelve changes for one drag is a log nobody reads.
    await audit.record(
        db,
        actor=actor,
        request=request,
        action="category.reorder",
        entity_type="category",
        summary=f"Reordered {len(payload.ids)} categories",
        changes={"order": {"from": None, "to": [str(i) for i in payload.ids]}},
    )
    await db.commit()
    ordered = await db.execute(select(Category).order_by(Category.sort_order, Category.created_at))
    return list(ordered.scalars().all())


@router.delete("/{category_id}", status_code=204)
async def delete_category(
    category_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    actor: User = Depends(require_admin),
) -> None:
    result = await db.execute(select(Category).where(Category.id == category_id))
    category = result.scalar_one_or_none()
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")
    await audit.record(
        db,
        actor=actor,
        request=request,
        action="category.delete",
        entity_type="category",
        entity_id=category.id,
        entity_label=category.name,
        summary=f"Deleted category {category.name}",
        changes={k: {"from": v, "to": None} for k, v in _audited_state(category).items()},
    )
    await db.delete(category)
    await db.commit()
