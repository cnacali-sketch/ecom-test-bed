"""Request/response schemas for the inventory router."""
from typing import Literal

from pydantic import BaseModel, Field


class SkuBulkRequest(BaseModel):
    brand: str = Field(..., min_length=1)
    category: str = Field(..., min_length=1)
    size: str = Field(..., min_length=1)
    count: int = Field(..., gt=0, le=10000)
    start_sequence: int = Field(1, ge=0)


class SkuBulkResponse(BaseModel):
    skus: list[str]


class BarcodeRequest(BaseModel):
    code: str = Field(..., description="Numeric code: 12 digits for EAN-13, 11 digits for UPC-A")
    barcode_type: Literal["ean13", "upca"] = "ean13"
    format: Literal["png", "svg"] = "png"
