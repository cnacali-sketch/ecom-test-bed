"""Request/response schemas for the recommendation router."""
from pydantic import BaseModel, Field


class SchemaInspectorRequest(BaseModel):
    product: dict = Field(..., description="A product dict to validate against schema.org Product")


class SchemaInspectorResponse(BaseModel):
    valid: bool
    missing_required: list[str]
    missing_recommended: list[str]
    score: int


class DescriptionAnalyzerRequest(BaseModel):
    description: str = Field(..., min_length=1)


class DescriptionAnalyzerResponse(BaseModel):
    score: int
    issues: list[str]
    suggestions: list[str]
