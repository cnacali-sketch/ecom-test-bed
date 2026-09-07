"""Inventory generator endpoints (Inventory Agent tools)."""
from fastapi import APIRouter, Depends, HTTPException, Response

from app.dependencies.auth import require_admin
from app.schemas.inventory import BarcodeRequest, SkuBulkRequest, SkuBulkResponse
from app.services import barcode_generator, sku_generator

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
