"""Validates a product dict against schema.org Product JSON-LD guidance.

Fields are grouped into "required" (Google's minimum for rich results) and
"recommended" (improves LLM/search visibility but is not mandatory). Nested
fields (e.g. `offers.price`) are checked via dotted-path lookup.
"""

_REQUIRED_FIELDS = ["name", "image", "description", "sku", "offers.price"]
_RECOMMENDED_FIELDS = ["brand", "aggregateRating", "review", "offers.priceCurrency", "offers.availability"]


def _get_nested(product: dict, dotted_path: str):
    """Look up a possibly-nested field (e.g. "offers.price") in `product`.

    Returns None if any segment of the path is missing or not a dict.
    """
    value = product
    for segment in dotted_path.split("."):
        if not isinstance(value, dict) or segment not in value:
            return None
        value = value[segment]
    return value


def _find_missing(product: dict, fields: list[str]) -> list[str]:
    """Return the subset of `fields` that are missing or falsy in `product`."""
    return [field for field in fields if not _get_nested(product, field)]


def inspect_product_schema(product: dict) -> dict:
    """Validate `product` against schema.org Product required/recommended fields.

    Returns:
        dict with keys:
            valid (bool): True if no required fields are missing.
            missing_required (list[str]): required field paths not present.
            missing_recommended (list[str]): recommended field paths not present.
            score (int): 0-100, weighted more heavily toward required fields.
    """
    missing_required = _find_missing(product, _REQUIRED_FIELDS)
    missing_recommended = _find_missing(product, _RECOMMENDED_FIELDS)

    required_score = (len(_REQUIRED_FIELDS) - len(missing_required)) / len(_REQUIRED_FIELDS)
    recommended_score = (
        (len(_RECOMMENDED_FIELDS) - len(missing_recommended)) / len(_RECOMMENDED_FIELDS)
    )

    # Required fields carry 70% of the score, recommended fields 30%.
    score = round((required_score * 0.7 + recommended_score * 0.3) * 100)

    return {
        "valid": len(missing_required) == 0,
        "missing_required": missing_required,
        "missing_recommended": missing_recommended,
        "score": score,
    }
