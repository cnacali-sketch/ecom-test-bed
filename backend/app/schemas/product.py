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
    # Null on all four means "ask the product" -- see the model docstring.
    size: str | None = Field(default=None, max_length=32)
    price: Decimal | None = Field(default=None, ge=0, decimal_places=2)
    mrp: Decimal | None = Field(default=None, ge=0, decimal_places=2)
    stock_quantity: int | None = Field(default=None, ge=0)


class ProductCreate(BaseModel):
    sku: str = Field(..., min_length=1, max_length=64)
    slug: str = Field(..., min_length=1, max_length=255)
    name: str = Field(..., min_length=1, max_length=255)
    price: Decimal = Field(..., ge=0, decimal_places=2)
    mrp: Decimal = Field(..., ge=0, decimal_places=2)
    in_stock: bool = True
    description: str | None = Field(default=None, max_length=5000)
    images: list[str] = Field(default_factory=list)
    attrs: dict = Field(default_factory=dict)
    #: On update, an empty list means "no change" -- not "delete them all".
    #:
    #: That reads like a wrong default until you look at who sends it. The
    #: admin console has posted `variants: []` on every product save for its
    #: whole life, because it has never had a variant editor. PUT survived that
    #: by ignoring the field entirely, which is the only reason the fifty
    #: variants in production still exist. The moment PUT starts honouring the
    #: field, every one of those saves becomes a request to delete them -- and
    #: not only from the old console, but from any browser tab still holding
    #: the old JavaScript after a deploy.
    #:
    #: So deletion is expressed by omitting a variant from a list that still
    #: has others in it. Removing the *last* variant is deliberately not
    #: expressible here: it is indistinguishable from what a stale client
    #: sends, and the cost of refusing it is one rare edit done in the
    #: database, against the cost of allowing it, which is silent data loss.
    variants: list[VariantCreate] | None = None


class VariantRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    sku: str
    color: str
    color_hex: str
    image: str | None
    in_stock: bool
    size: str | None = None
    price: Decimal | None = None
    mrp: Decimal | None = None
    stock_quantity: int | None = None


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
