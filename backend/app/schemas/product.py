"""Request/response schemas for the products router."""
import uuid

from pydantic import BaseModel, ConfigDict, Field


class ProductCreate(BaseModel):
    sku: str = Field(..., min_length=1, max_length=64)
    name: str = Field(..., min_length=1, max_length=255)
    price: float = Field(..., ge=0)
    mrp: float = Field(..., ge=0)
    description: str | None = None
    images: list[str] = Field(default_factory=list)
    attrs: dict = Field(default_factory=dict)


class ProductVariantRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    sku: str
    name: str
    price: float
    mrp: float
    description: str | None
    images: list[str]
    attrs: dict


class ProductRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    sku: str
    name: str
    price: float
    mrp: float
    description: str | None
    images: list[str]
    attrs: dict
    variants: list[ProductVariantRead] = []
