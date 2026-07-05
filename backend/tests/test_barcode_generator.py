"""Unit tests for app.services.barcode_generator (pure functions, no I/O)."""
import pytest

from app.services.barcode_generator import (
    compute_ean13_checksum,
    generate_ean13,
    generate_upca,
)


class TestComputeEan13Checksum:
    def test_computes_correct_checksum_digit(self):
        # Known example: 400638133393 -> checksum digit 1
        assert compute_ean13_checksum("400638133393") == 1

    def test_computes_checksum_for_all_zeros(self):
        assert compute_ean13_checksum("000000000000") == 0

    def test_raises_on_wrong_length(self):
        with pytest.raises(ValueError):
            compute_ean13_checksum("12345")

    def test_raises_on_non_digit_input(self):
        with pytest.raises(ValueError):
            compute_ean13_checksum("abcdefghijkl")


class TestGenerateEan13:
    def test_returns_png_and_svg_bytes(self):
        # Arrange
        code = "400638133393"

        # Act
        result = generate_ean13(code)

        # Assert
        assert result["ean13"] == "4006381333931"
        assert isinstance(result["png"], bytes)
        assert isinstance(result["svg"], bytes)
        assert len(result["png"]) > 0
        assert len(result["svg"]) > 0

    def test_png_has_png_magic_bytes(self):
        result = generate_ean13("400638133393")
        assert result["png"][:8] == b"\x89PNG\r\n\x1a\n"

    def test_svg_starts_with_xml_declaration(self):
        result = generate_ean13("400638133393")
        assert result["svg"].startswith(b"<?xml")

    def test_raises_on_too_short_input(self):
        with pytest.raises(ValueError):
            generate_ean13("12345")

    def test_raises_on_too_long_input(self):
        with pytest.raises(ValueError):
            generate_ean13("12345678901234")

    def test_raises_on_non_numeric_input(self):
        with pytest.raises(ValueError):
            generate_ean13("abcdefghijkl")


class TestGenerateUpca:
    def test_returns_png_and_svg_bytes(self):
        # Arrange
        code = "03600029145"

        # Act
        result = generate_upca(code)

        # Assert
        assert result["upca"] == "036000291452"
        assert isinstance(result["png"], bytes)
        assert isinstance(result["svg"], bytes)
        assert len(result["png"]) > 0
        assert len(result["svg"]) > 0

    def test_raises_on_too_short_input(self):
        with pytest.raises(ValueError):
            generate_upca("123")

    def test_raises_on_too_long_input(self):
        with pytest.raises(ValueError):
            generate_upca("1234567890123")

    def test_raises_on_non_numeric_input(self):
        with pytest.raises(ValueError):
            generate_upca("abcdefghijk")
