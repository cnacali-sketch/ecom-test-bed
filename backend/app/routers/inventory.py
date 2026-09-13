"""Inventory generator endpoints (Inventory Agent tools), plus stock history."""
import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db_session
from app.dependencies.auth import require_admin
from app.models.inventory_snapshot import InventorySnapshot
from app.schemas.inventory import BarcodeRequest, SkuBulkRequest, SkuBulkResponse
from app.services import barcode_generator, inventory_snapshots, sku_generator

# Internal tooling for admin/back-office use only. Was unauthenticated --
# not data-leaking (no DB access, pure computation), but bulk SKU/barcode
# generation is still a CPU-spend lever a public, unthrottled caller could
# lean on (e.g. a large `count` in a loop) -- gate it like every other
# internal-tool router instead of leaving it the one inconsistent exception.
router = APIRouter(prefix="/api/inventory", tags=["inventory"], dependencies=[Depends(require_admin)])

_MEDIA_TYPES = {"png": "image/png", "svg": "image/svg+xml"}


@router.post("/sku", response_model=SkuBulkResponse)
async def generate_skus(payload: SkuBulkRequest) -> SkuBulkResponse:
    """Bulk-generate SKUs from a brand/category/size spec."""
    spec = {"brand": payload.brand, "category": payload.category, "size": payload.size}
    try:
        skus = sku_generator.bulk_generate(spec, count=payload.count, start_sequence=payload.start_sequence)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return SkuBulkResponse(skus=skus)


@router.post("/barcode")
async def generate_barcode(payload: BarcodeRequest) -> Response:
    """Generate a UPC-A or EAN-13 barcode image, returned as raw PNG or SVG bytes."""
    try:
        if payload.barcode_type == "ean13":
            result = barcode_generator.generate_ean13(payload.code)
        else:
            result = barcode_generator.generate_upca(payload.code)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    image_bytes = result[payload.format]
    return Response(content=image_bytes, media_type=_MEDIA_TYPES[payload.format])


class SnapshotRead(BaseModel):
    """One reading. Deliberately just the reading."""

    model_config = ConfigDict(from_attributes=True)
    product_id: uuid.UUID
    quantity: int
    snapshot_date: date


@router.get("/snapshots", response_model=list[SnapshotRead])
async def list_snapshots(
    product_id: uuid.UUID | None = None,
    days: int = Query(default=30, ge=1, le=365),
    db: AsyncSession = Depends(get_db_session),
) -> list[InventorySnapshot]:
    """Stock readings, newest day first.

    Readings, and nothing computed from them. There is no days-of-stock-left
    here and no reorder point, because the shop has eleven lifetime orders
    across thirty-three products: any rate derived from that is arithmetic on
    noise, and a number on an admin screen gets believed. The table starts
    filling now so that the question can be answered later, by which time there
    will be something to answer it with.
    """
    since = datetime.now(timezone.utc).date() - timedelta(days=days)
    query = (
        select(InventorySnapshot)
        .where(InventorySnapshot.snapshot_date >= since)
        .order_by(
            InventorySnapshot.snapshot_date.desc(), InventorySnapshot.product_id
        )
    )
    if product_id is not None:
        query = query.where(InventorySnapshot.product_id == product_id)
    return list((await db.execute(query)).scalars().all())


@router.post("/snapshots/capture", response_model=dict)
async def capture_snapshots(db: AsyncSession = Depends(get_db_session)) -> dict:
    """Take today's reading now, instead of waiting for the timer.

    Idempotent: a product already recorded today is skipped, so this is safe to
    press twice and safe to press on a day the scheduled run already covered.
    """
    written = await inventory_snapshots.capture(db)
    return {"recorded": written}
