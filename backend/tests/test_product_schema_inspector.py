"""Unit tests for app.services.product_schema_inspector (pure functions, no I/O)."""
from app.services.product_schema_inspector import inspect_product_schema

COMPLETE_PRODUCT = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": "Wireless Headphones",
    "image": "https://example.com/headphones.jpg",
    "description": "Noise-cancelling over-ear wireless headphones with 30h battery life.",
    "sku": "NIKE-SHOE-M-0001",
    "brand": {"@type": "Brand", "name": "AudioCo"},
    "offers": {
        "@type": "Offer",
        "price": "199.99",
        "priceCurrency": "USD",
        "availability": "https://schema.org/InStock",
    },
    "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.5",
        "reviewCount": "120",
    },
    "review": [
        {
            "@type": "Review",
            "author": "Jane Doe",
            "reviewRating": {"@type": "Rating", "ratingValue": "5"},
        }
    ],
}


class TestInspectProductSchema:
    def test_complete_product_scores_fully_valid(self):
        # Act
        result = inspect_product_schema(COMPLETE_PRODUCT)

        # Assert
        assert result["valid"] is True
        assert result["missing_required"] == []
        assert result["missing_recommended"] == []
        assert result["score"] == 100

    def test_missing_price_flags_as_missing_required(self):
        # Arrange: remove price from offers -> price is a required field
        product = {k: v for k, v in COMPLETE_PRODUCT.items() if k != "offers"}

        # Act
        result = inspect_product_schema(product)

        # Assert
        assert "offers.price" in result["missing_required"] or "price" in result["missing_required"]
        assert result["valid"] is False

    def test_missing_review_flags_as_missing_recommended_only(self):
        # Arrange: remove review, keep all required fields
        product = {k: v for k, v in COMPLETE_PRODUCT.items() if k != "review"}

        # Act
        result = inspect_product_schema(product)

        # Assert
        assert "review" in result["missing_recommended"]
        assert "review" not in result["missing_required"]
        # All required fields are still present
        assert result["missing_required"] == []

    def test_missing_name_flags_as_missing_required(self):
        product = {k: v for k, v in COMPLETE_PRODUCT.items() if k != "name"}
        result = inspect_product_schema(product)
        assert "name" in result["missing_required"]
        assert result["valid"] is False

    def test_empty_product_dict_flags_all_required_missing(self):
        result = inspect_product_schema({})
        assert result["valid"] is False
        assert len(result["missing_required"]) > 0
        assert result["score"] < 100

    def test_score_is_between_zero_and_hundred(self):
        result = inspect_product_schema({"name": "Only a name"})
        assert 0 <= result["score"] <= 100

    def test_missing_aggregate_rating_flags_as_recommended(self):
        product = {k: v for k, v in COMPLETE_PRODUCT.items() if k != "aggregateRating"}
        result = inspect_product_schema(product)
        assert "aggregateRating" in result["missing_recommended"]
        assert result["missing_required"] == []
