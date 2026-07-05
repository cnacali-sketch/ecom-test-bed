"""Request/response schemas for the pricing router."""
from pydantic import BaseModel, Field


class MarkupRequest(BaseModel):
    cost: float = Field(..., gt=0, description="Unit cost, must be greater than zero")
    margin_pct: float = Field(..., ge=0, description="Desired margin percentage")


class MarkupResponse(BaseModel):
    price: float


class ProfitMarginRequest(BaseModel):
    cost: float = Field(..., ge=0, description="Unit cost")
    price: float = Field(..., gt=0, description="Selling price, must be greater than zero")


class ProfitMarginResponse(BaseModel):
    margin_pct: float


class BreakEvenRequest(BaseModel):
    fixed_costs: float = Field(..., ge=0)
    price: float = Field(..., gt=0)
    variable_cost: float = Field(..., ge=0)


class BreakEvenResponse(BaseModel):
    units: float
