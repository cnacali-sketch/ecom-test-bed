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
from sqlalchemy import Text, func, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db_session
from app.dependencies.auth import require_admin
from app.models.product import Product, ProductVariant
from app.models.user import User
from app.schemas.product import ProductCreate, ProductRead
from app.services import audit, search

router = APIRouter(prefix="/api/products", tags=["products"])


def _reconcile_variants(product: Product, incoming) -> dict[str, list[str]]:
    """Bring a product's variants in line with what the editor sent.

    Matched on SKU rather than on id or list position. The SKU is the thing a
    person actually types and the thing the rest of the system already treats
    as a variant's identity; matching on position would rename every variant
    below a deleted row, and matching on id would make a variant created in the
    browser impossible to express.

    Returns what moved, so the audit entry can say "removed Tortoise" instead
    of "variants changed".
    """
    by_sku = {variant.sku: variant for variant in product.variants}
    sent = {item.sku for item in incoming}

    added: list[str] = []
    updated: list[str] = []
    for item in incoming:
        fields = item.model_dump()
        existing = by_sku.get(item.sku)
        if existing is None:
            product.variants.append(ProductVariant(**fields))
            added.append(item.sku)
            continue
        if any(getattr(existing, name) != value for name, value in fields.items()):
            for name, value in fields.items():
                setattr(existing, name, value)
            updated.append(item.sku)

    removed = sorted(sku for sku in by_sku if sku not in sent)
    for sku in removed:
        # delete-orphan on the relationship turns this into a DELETE.
        product.variants.remove(by_sku[sku])

    return {"added": sorted(added), "updated": sorted(updated), "removed": removed}


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


def _collection_clause(statement, db: AsyncSession, collection: str):
    """Restrict to one collection, in SQL rather than in Python.

    `attrs.collectionSlugs` is a JSON array. Postgres can ask whether it
    contains a value directly; SQLite has no equivalent that works through the
    ORM, so it falls back to matching the serialised array text. That fallback
    is quoted deliberately -- searching for `"jewellery"` with the quotes
    cannot match a longer slug that merely starts with it, which an unquoted
    LIKE would.
    """
    if search.is_postgres(db):
        return statement.where(
            Product.attrs["collectionSlugs"].contains(func.cast(collection, JSONB))
        )
    # json_extract narrows to the one field. Matching the whole attrs blob
    # instead would put any product *tagged* "jewellery" into the jewellery
    # *collection* -- a quieter wrong answer than returning nothing, and one
    # Postgres would never give, so the two paths would disagree about what a
    # collection is.
    return statement.where(
        func.coalesce(
            func.json_extract(Product.attrs, "$.collectionSlugs"), ""
        ).like(f'%"{collection}"%')
    )


@router.get("", response_model=list[ProductRead])
async def list_products(
    q: str | None = Query(None, description="Full-text search across name, type, material, tags and description"),
    collection: str | None = Query(None, description="Filter by collection slug (attrs.collectionSlugs)"),
    in_stock: bool | None = Query(None),
    limit: int = Query(48, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db_session),
) -> list[Product]:
    """List products, optionally searched and filtered.

    `q` searches server-side. It used to be impossible: the storefront
    downloaded the whole catalogue and substring-matched it in the browser,
    which meant every consumer had to reimplement search and every visitor who
    opened the box paid for the entire catalogue.
    """
    stmt = _q(db)

    if in_stock is not None:
        stmt = stmt.where(Product.in_stock == in_stock)

    if collection is not None:
        stmt = _collection_clause(stmt, db, collection)

    if q:
        # Applied before the ordering below so the relevance ordering it adds
        # is the primary sort; newest-first only decides ties.
        stmt = search.apply_search(stmt, db, q)

    stmt = stmt.order_by(Product.created_at.desc())

    # Limit and offset go on last, and that ordering is the whole fix for a
    # real bug: the collection filter used to run in Python *after* the page
    # had already been cut to 48 rows, so asking for one collection returned
    # only its members that happened to be among the 48 newest products, and
    # silently dropped the rest. Invisible at thirty-three products, wrong at
    # a hundred.
    result = await db.execute(stmt.limit(limit).offset(offset))
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
    for v in payload.variants or []:
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

    # An empty or absent list leaves the variants alone. Only a list with
    # something in it is treated as the new set -- see ProductCreate.variants
    # for why an empty one cannot safely mean "delete them all".
    variant_moves = _reconcile_variants(product, payload.variants) if payload.variants else {}

    changed = audit.diff(before, _audited_state(product))
    for kind, skus in variant_moves.items():
        if skus:
            changed[f"variants_{kind}"] = {"from": None, "to": skus}
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
