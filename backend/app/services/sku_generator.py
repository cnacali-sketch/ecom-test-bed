"""Pattern-based SKU generation for the Inventory Agent.

Format: "{BRAND}-{CATEGORY}-{SIZE}-{seq:04d}"

Only alphanumeric characters are allowed in brand/category/size segments,
to guarantee SKUs are safe to use as barcodes, URL slugs, and filenames.
"""
import re

_VALID_SEGMENT_RE = re.compile(r"^[A-Za-z0-9]+$")
_SEQUENCE_PAD_WIDTH = 4


def _validate_segment(value: str, field_name: str) -> str:
    """Validate a brand/category/size segment, returning it uppercased.

    Raises:
        ValueError: if `value` is empty or contains non-alphanumeric characters.
    """
    if not value or not _VALID_SEGMENT_RE.match(value):
        raise ValueError(f"{field_name} must be a non-empty alphanumeric string, got {value!r}")
    return value.upper()


def generate_sku(brand: str, category: str, size: str, sequence: int) -> str:
    """Generate a single SKU string: "{BRAND}-{CATEGORY}-{SIZE}-{seq:04d}".

    Raises:
        ValueError: if any segment is empty/invalid, or `sequence` is negative.
    """
    if sequence < 0:
        raise ValueError("sequence must not be negative")

    brand_part = _validate_segment(brand, "brand")
    category_part = _validate_segment(category, "category")
    size_part = _validate_segment(size, "size")

    return f"{brand_part}-{category_part}-{size_part}-{sequence:0{_SEQUENCE_PAD_WIDTH}d}"


def bulk_generate(spec: dict, count: int, start_sequence: int = 1) -> list[str]:
    """Generate `count` unique SKUs from a spec dict with brand/category/size keys.

    Raises:
        ValueError: if `count` is not strictly positive, or the spec is invalid.
    """
    if count <= 0:
        raise ValueError("count must be greater than zero")

    brand = spec.get("brand", "")
    category = spec.get("category", "")
    size = spec.get("size", "")

    return [
        generate_sku(brand, category, size, start_sequence + offset)
        for offset in range(count)
    ]
