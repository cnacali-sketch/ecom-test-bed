"""UPC-A / EAN-13 barcode generation with PNG + SVG export.

Uses the open-source `python-barcode` library. All input validation is
done explicitly here because `python-barcode` itself silently truncates
overlong numeric input rather than raising -- we want a hard failure on
invalid input length instead.
"""
import io

from barcode import EAN13, UPCA
from barcode.writer import ImageWriter, SVGWriter

_EAN13_INPUT_LENGTH = 12  # digits, before the checksum digit is appended
_UPCA_INPUT_LENGTH = 11  # digits, before the checksum digit is appended


def _validate_numeric_code(code: str, expected_length: int, label: str) -> None:
    """Validate that `code` is exactly `expected_length` numeric digits.

    Raises:
        ValueError: if `code` is not all digits, or has the wrong length.
    """
    if not code.isdigit():
        raise ValueError(f"{label} must contain only digits, got {code!r}")
    if len(code) != expected_length:
        raise ValueError(
            f"{label} must be exactly {expected_length} digits, got {len(code)} digits"
        )


def compute_ean13_checksum(code12: str) -> int:
    """Compute the EAN-13 checksum digit for a 12-digit code.

    Odd positions (1st, 3rd, ... 11th, 1-indexed) are weighted x1, even
    positions (2nd, 4th, ... 12th) are weighted x3. The checksum digit
    makes the weighted sum a multiple of 10.

    Raises:
        ValueError: if `code12` is not exactly 12 numeric digits.
    """
    _validate_numeric_code(code12, _EAN13_INPUT_LENGTH, "code12")
    digits = [int(d) for d in code12]
    odd_sum = sum(digits[0::2])
    even_sum = sum(digits[1::2])
    total = odd_sum + even_sum * 3
    return (10 - (total % 10)) % 10


def _render_barcode(barcode_instance) -> dict[str, bytes]:
    """Render a `python-barcode` instance to PNG and SVG bytes."""
    png_buffer = io.BytesIO()
    barcode_instance.writer = ImageWriter()
    barcode_instance.write(png_buffer)

    svg_buffer = io.BytesIO()
    barcode_instance.writer = SVGWriter()
    barcode_instance.write(svg_buffer)

    return {"png": png_buffer.getvalue(), "svg": svg_buffer.getvalue()}


def generate_ean13(code12: str) -> dict:
    """Generate an EAN-13 barcode (PNG + SVG) from a 12-digit code.

    Returns:
        dict with keys: "ean13" (full 13-digit code string), "png" (bytes),
        "svg" (bytes).

    Raises:
        ValueError: if `code12` is not exactly 12 numeric digits.
    """
    _validate_numeric_code(code12, _EAN13_INPUT_LENGTH, "code12")
    barcode_instance = EAN13(code12, writer=ImageWriter())
    rendered = _render_barcode(barcode_instance)
    return {"ean13": barcode_instance.ean, **rendered}


def generate_upca(code11: str) -> dict:
    """Generate a UPC-A barcode (PNG + SVG) from an 11-digit code.

    Returns:
        dict with keys: "upca" (full 12-digit code string), "png" (bytes),
        "svg" (bytes).

    Raises:
        ValueError: if `code11` is not exactly 11 numeric digits.
    """
    _validate_numeric_code(code11, _UPCA_INPUT_LENGTH, "code11")
    barcode_instance = UPCA(code11, writer=ImageWriter())
    rendered = _render_barcode(barcode_instance)
    return {"upca": barcode_instance.upc, **rendered}
