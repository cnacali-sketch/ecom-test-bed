"""Pricing calculator endpoints (Pricing Agent tools)."""
from fastapi import APIRouter, HTTPException

from app.schemas.pricing import (
    BreakEvenRequest,
    BreakEvenResponse,
    MarkupRequest,
    MarkupResponse,
    MarginRequest,
    MarginResponse,
)
from app.services import pricing_calculators

router = APIRouter(prefix="/api/pricing", tags=["pricing"])


@router.post("/markup", response_model=MarkupResponse)
async def calculate_markup(payload: MarkupRequest) -> MarkupResponse:
    """Compute the retail price from cost and desired margin percentage."""
    try:
        price = pricing_calculators.markup(payload.cost, payload.margin_pct)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return MarkupResponse(price=price)


@router.post("/margin", response_model=MarginResponse)
async def calculate_profit_margin(payload: MarginRequest) -> MarginResponse:
    """Compute the profit margin percentage from cost and selling price."""
    try:
        margin_pct = pricing_calculators.profit_margin(payload.cost, payload.price)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return MarginResponse(margin_pct=margin_pct)


@router.post("/break-even", response_model=BreakEvenResponse)
async def calculate_break_even(payload: BreakEvenRequest) -> BreakEvenResponse:
    """Compute the number of units needed to break even on fixed costs."""
    try:
        units = pricing_calculators.break_even(
            payload.fixed_costs, payload.price, payload.variable_cost
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return BreakEvenResponse(break_even=units)
