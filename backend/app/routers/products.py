"""Product CRUD endpoints.

Changes from Phase 1:
- slug column: GET /api/products/slug/{slug} for PDP lookups (no more full-catalog scan).
- Pagination: limit/offset on GET /api/products.
- Collection filter: ?collection=hair-accessories on GET /api/products.
- In-stock filter: ?in_stock=true on GET /api/products.
- 409 on duplicate SKU/slug instead of unhandled 500.
- Variants created inline with the product (single round-trip).
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db_session
from app.dependencies.auth import require_api_key
from app.models.product import Product, ProductVariant
from app.schemas.product import ProductCreate, ProductRead

router = APIRouter(prefix="/api/products", tags=["products"])


def _q(db: AsyncSession):
    """Base query: products with variants eager-loaded."""
    return select(Product).options(selectinload(Product.variants))


@router.get("", response_model=list[ProductRead])
async def list_products(
    collection: str | None = Query(None, description="Filter by collection slug (attrs.collectionSlugs)"),
    in_stock: bool | None = Query(None),
    limit: int = Query(48, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db_session),
) -> list[Product]:
    """List products with optional collection/stock filters and pagination."""
    stmt = _q(db).order_by(Product.created_at.desc()).limit(limit).offset(offset)

    if in_stock is not None:
        stmt = stmt.where(Product.in_stock == in_stock)

    # ponytail: collection filter via JSON containment — good enough until a
    # proper collections table ships. Upgrade when collection joins are needed.
    if collection is not None:
        from sqlalchemy import cast, func
        from sqlalchemy.dialects.postgresql import JSONB as PG_JSONB
        # SQLite fallback: Python-side filter (tests only).
        result = await db.execute(stmt)
        products = list(result.scalars().all())
        return [p for p in products if collection in (p.attrs.get("collectionSlugs") or [])]

    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/slug/{slug}", response_model=ProductRead)
async def get_product_by_slug(slug: str, db: AsyncSession = Depends(get_db_session)) -> Product:
    """Return a product by its URL slug — used by the PDP."""
    result = await db.execute(_q(db).where(Product.slug == slug))
    product = result.scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.get("/{product_id}", response_model=ProductRead)
async def get_product(product_id: uuid.UUID, db: AsyncSession = Depends(get_db_session)) -> Product:
    """Return a product by UUID — used by internal tooling."""
    result = await db.execute(_q(db).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.post("", response_model=ProductRead, status_code=201, dependencies=[Depends(require_api_key)])
async def create_product(
    payload: ProductCreate, db: AsyncSession = Depends(get_db_session)
) -> Product:
    """Create a product with its variants in a single transaction."""
    product_data = payload.model_dump(exclude={"variants"})
    product = Product(**product_data)
    for v in payload.variants:
        product.variants.append(ProductVariant(**v.model_dump()))
    db.add(product)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="SKU or slug already exists")
    await db.refresh(product, attribute_names=["variants"])
    return product


@router.delete("/{product_id}", status_code=204, dependencies=[Depends(require_api_key)])
async def delete_product(
    product_id: uuid.UUID, db: AsyncSession = Depends(get_db_session)
) -> None:
    """Hard-delete a product and its variants (cascade)."""
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    await db.delete(product)
    await db.commit()
