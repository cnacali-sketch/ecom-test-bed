"""Unit tests for app.services.sku_generator (pure functions, no I/O)."""
import pytest

from app.services.sku_generator import bulk_generate, generate_sku


class TestGenerateSku:
    def test_deterministic_format(self):
        # Arrange
        brand = "NIKE"
        category = "SHOE"
        size = "M"
        sequence = 7

        # Act
        sku = generate_sku(brand, category, size, sequence)

        # Assert
        assert sku == "NIKE-SHOE-M-0007"

    def test_format_pads_sequence_to_four_digits(self):
        assert generate_sku("ACME", "HAT", "L", 1).endswith("-0001")

    def test_format_allows_large_sequence_without_truncation(self):
        assert generate_sku("ACME", "HAT", "L", 12345) == "ACME-HAT-L-12345"

    def test_uppercases_brand_and_category(self):
        assert generate_sku("nike", "shoe", "m", 1) == "NIKE-SHOE-M-0001"

    def test_rejects_invalid_brand_chars(self):
        with pytest.raises(ValueError):
            generate_sku("NI KE!", "SHOE", "M", 1)

    def test_rejects_invalid_category_chars(self):
        with pytest.raises(ValueError):
            generate_sku("NIKE", "SH/OE", "M", 1)

    def test_rejects_empty_brand(self):
        with pytest.raises(ValueError):
            generate_sku("", "SHOE", "M", 1)

    def test_rejects_negative_sequence(self):
        with pytest.raises(ValueError):
            generate_sku("NIKE", "SHOE", "M", -1)


class TestBulkGenerate:
    def test_bulk_generate_returns_requested_count(self):
        # Arrange
        spec = {"brand": "NIKE", "category": "SHOE", "size": "M"}

        # Act
        skus = bulk_generate(spec, count=100)

        # Assert
        assert len(skus) == 100

    def test_bulk_generate_uniqueness_across_100(self):
        # Arrange
        spec = {"brand": "NIKE", "category": "SHOE", "size": "M"}

        # Act
        skus = bulk_generate(spec, count=100)

        # Assert
        assert len(set(skus)) == 100

    def test_bulk_generate_rejects_zero_count(self):
        spec = {"brand": "NIKE", "category": "SHOE", "size": "M"}
        with pytest.raises(ValueError):
            bulk_generate(spec, count=0)

    def test_bulk_generate_rejects_invalid_spec(self):
        spec = {"brand": "NI!KE", "category": "SHOE", "size": "M"}
        with pytest.raises(ValueError):
            bulk_generate(spec, count=5)

    def test_bulk_generate_starts_sequence_at_one_by_default(self):
        spec = {"brand": "NIKE", "category": "SHOE", "size": "M"}
        skus = bulk_generate(spec, count=1)
        assert skus[0] == "NIKE-SHOE-M-0001"
