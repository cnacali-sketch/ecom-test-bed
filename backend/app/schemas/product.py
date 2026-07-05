"""Request/response schemas for the products router."""
import uuid
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class VariantCreate(BaseModel):
    sku: str = Field(..., min_length=1, max_length=64)
    color: str = Field(..., max_length=64)
    color_hex: str = Field(..., max_length=16)
    image: str | None = None
    in_stock: bool = True


class ProductCreate(BaseModel):
    sku: str = Field(..., min_length=1, max_length=64)
    slug: str = Field(..., min_length=1, max_length=255)
    name: str = Field(..., min_length=1, max_length=255)
    price: Decimal = Field(..., ge=0, decimal_places=2)
    mrp: Decimal = Field(..., ge=0, decimal_places=2)
    in_stock: bool = True
    description: str | None = None
    images: list[str] = Field(default_factory=list)
    attrs: dict = Field(default_factory=dict)
    variants: list[VariantCreate] = Field(default_factory=list)


class VariantRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    sku: str
    color: str
    color_hex: str
    image: str | None
    in_stock: bool


class ProductRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    sku: str
    slug: str
    name: str
    price: Decimal
    mrp: Decimal
    in_stock: bool
    description: str | None
    images: list[str]
    attrs: dict
    variants: list[VariantRead] = []
