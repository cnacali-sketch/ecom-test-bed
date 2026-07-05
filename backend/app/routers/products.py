"""Minimal Product CRUD endpoints, backed by the Product model.

Kept intentionally minimal for Phase 1 -- just enough for the frontend to
list/fetch/create products. Fuller catalog features (variants, search,
filtering) are out of scope for this phase.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db_session
from app.models.product import Product
from app.schemas.product import ProductCreate, ProductRead

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("", response_model=list[ProductRead])
async def list_products(db: AsyncSession = Depends(get_db_session)) -> list[Product]:
    """Return all products."""
    result = await db.execute(select(Product).options(selectinload(Product.variants)))
    return list(result.scalars().all())


@router.get("/{product_id}", response_model=ProductRead)
async def get_product(product_id: uuid.UUID, db: AsyncSession = Depends(get_db_session)) -> Product:
    """Return a single product by id, or 404 if not found."""
    result = await db.execute(
        select(Product).options(selectinload(Product.variants)).where(Product.id == product_id)
    )
    product = result.scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.post("", response_model=ProductRead, status_code=201)
async def create_product(
    payload: ProductCreate, db: AsyncSession = Depends(get_db_session)
) -> Product:
    """Create a new product."""
    product = Product(**payload.model_dump())
    db.add(product)
    await db.commit()
    await db.refresh(product, attribute_names=["variants"])
    return product
