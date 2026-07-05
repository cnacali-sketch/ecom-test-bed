from decimal import Decimal
from pydantic import BaseModel, Field


class MarkupRequest(BaseModel):
    cost: Decimal = Field(..., gt=0)
    margin_pct: Decimal = Field(..., ge=0)


class MarkupResponse(BaseModel):
    price: Decimal


class MarginRequest(BaseModel):
    cost: Decimal = Field(..., ge=0)
    price: Decimal = Field(..., gt=0, description="Selling price, must be greater than zero")


class MarginResponse(BaseModel):
    margin_pct: Decimal


class BreakEvenRequest(BaseModel):
    fixed_costs: Decimal = Field(..., ge=0)
    price: Decimal = Field(..., gt=0)
    variable_cost: Decimal = Field(..., ge=0)


class BreakEvenResponse(BaseModel):
    break_even: Decimal
