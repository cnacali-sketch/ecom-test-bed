"""Recommendation-quality checker endpoints (Recommendation Agent tools)."""
from fastapi import APIRouter, Depends, HTTPException

from app.dependencies.auth import require_admin
from app.schemas.recommendation import (
    DescriptionAnalyzerRequest,
    DescriptionAnalyzerResponse,
    SchemaInspectorRequest,
    SchemaInspectorResponse,
)
from app.services import description_analyzer, product_schema_inspector

# Internal back-office tooling, same reasoning as pricing.py and inventory.py:
# pure computation (no DB access, nothing data-leaking) but still an
# unauthenticated CPU-spend lever with no reason to be public.
router = APIRouter(
    prefix="/api/recommendation", tags=["recommendation"], dependencies=[Depends(require_admin)]
)


@router.post("/schema-inspector", response_model=SchemaInspectorResponse)
async def inspect_schema(payload: SchemaInspectorRequest) -> SchemaInspectorResponse:
    """Validate a product dict against schema.org Product JSON-LD guidance."""
    result = product_schema_inspector.inspect_product_schema(payload.product)
    return SchemaInspectorResponse(**result)


@router.post("/description-analyzer", response_model=DescriptionAnalyzerResponse)
async def analyze_product_description(payload: DescriptionAnalyzerRequest) -> DescriptionAnalyzerResponse:
    """Heuristically score a product description's LLM/recommendation readiness."""
    try:
        result = description_analyzer.analyze_description(payload.description)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return DescriptionAnalyzerResponse(**result)
