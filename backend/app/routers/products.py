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

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db_session
from app.dependencies.auth import require_admin
from app.models.product import Product, ProductVariant
from app.models.user import User
from app.schemas.product import ProductCreate, ProductRead
from app.services import audit

router = APIRouter(prefix="/api/products", tags=["products"])


def _audited_state(product: Product) -> dict:
    """The fields worth being able to answer questions about later.

    Price and MRP because they are money; stock and `in_stock` because an
    unexplained stock movement is the other thing somebody comes to this log
    to investigate; name and slug because a renamed product is hard to trace
    afterwards without them. The rest of `attrs` is display copy and would
    bury the money in noise.
    """
    attrs = product.attrs or {}
    return {
        "name": product.name,
        "slug": product.slug,
        "price": product.price,
        "mrp": product.mrp,
        "in_stock": product.in_stock,
        "stock": attrs.get("stock"),
        "cost": attrs.get("cost"),
    }


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


@router.post("", response_model=ProductRead, status_code=201, dependencies=[Depends(require_admin)])
async def create_product(
    payload: ProductCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    actor: User = Depends(require_admin),
) -> Product:
    """Create a product with its variants in a single transaction."""
    product_data = payload.model_dump(exclude={"variants"})
    product = Product(**product_data)
    for v in payload.variants:
        product.variants.append(ProductVariant(**v.model_dump()))
    db.add(product)
    # Flush, audit and commit share one `try`. Writing an audit entry flushes
    # the session, so a duplicate SKU now surfaces as an IntegrityError here
    # rather than at commit — outside this guard it would reach the client as
    # a 500 instead of the 409 the API promises.
    try:
        await db.flush()
        await audit.record(
            db,
            actor=actor,
            request=request,
            action="product.create",
            entity_type="product",
            entity_id=product.id,
            entity_label=product.name,
            summary=f"Added {product.name} at {product.price}",
            changes={k: {"from": None, "to": v} for k, v in _audited_state(product).items()},
        )
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="SKU or slug already exists")
    await db.refresh(product, attribute_names=["variants"])
    return product


@router.put("/{product_id}", response_model=ProductRead, dependencies=[Depends(require_admin)])
async def update_product(
    product_id: uuid.UUID,
    payload: ProductCreate,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    actor: User = Depends(require_admin),
) -> Product:
    """Update an existing product's own fields (admin editor save).

    Variants are left untouched — the admin console doesn't manage them, so
    they're not in scope for a save from that UI. `sku` is immutable here too:
    it's an identity key used elsewhere (e.g. the storefront's product id), so
    a caller editing price/stock must not be able to reassign it by accident.
    `attrs` is merged rather than replaced — the admin editor only models a
    subset of keys (cost, stock, badge, ...), and a caller that only sends
    those must not wipe out the rest (brand, material, care instructions, ...).
    """
    result = await db.execute(_q(db).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")

    before = _audited_state(product)
    update_data = payload.model_dump(exclude={"variants", "sku", "attrs"})
    for field, value in update_data.items():
        setattr(product, field, value)
    product.attrs = {**product.attrs, **payload.attrs}

    changed = audit.diff(before, _audited_state(product))
    # Audit and commit share one `try`, for the same reason as `create_product`
    # above: recording flushes, so a duplicate slug raises here rather than at
    # commit and must still become a 409.
    try:
        # A save that moved nothing worth recording writes nothing. The editor
        # sends the whole product on every save, so without this the log fills
        # with entries for opening a product and closing it again.
        if changed:
            await audit.record(
                db,
                actor=actor,
                request=request,
                action="product.update",
                entity_type="product",
                entity_id=product.id,
                entity_label=product.name,
                summary=f"Edited {product.name}: {', '.join(sorted(changed))}",
                changes=changed,
            )
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="SKU or slug already exists")
    await db.refresh(product, attribute_names=["variants"])
    return product


@router.delete("/{product_id}", status_code=204, dependencies=[Depends(require_admin)])
async def delete_product(
    product_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    actor: User = Depends(require_admin),
) -> None:
    """Hard-delete a product and its variants (cascade)."""
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")

    # Recorded before the delete: afterwards the name and price are gone, and
    # an entry saying only that some id was removed answers nothing.
    await audit.record(
        db,
        actor=actor,
        request=request,
        action="product.delete",
        entity_type="product",
        entity_id=product.id,
        entity_label=product.name,
        summary=f"Deleted {product.name} ({product.sku})",
        changes={k: {"from": v, "to": None} for k, v in _audited_state(product).items()},
    )
    await db.delete(product)
    await db.commit()
