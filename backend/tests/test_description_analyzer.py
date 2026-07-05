"""Unit tests for app.services.description_analyzer (pure functions, no LLM call)."""
from unittest.mock import patch

from app.services import description_analyzer
from app.services.description_analyzer import analyze_description

SHORT_DESCRIPTION = "Nice cool shoe"

WELL_FORMED_DESCRIPTION = (
    "These wireless headphones deliver crisp, noise-cancelling sound for up to "
    "30 hours on a single charge. The soft memory-foam ear cushions stay "
    "comfortable through long listening sessions, and the foldable design "
    "makes them easy to pack for travel."
)


class TestAnalyzeDescription:
    def test_short_description_scores_low(self):
        # Act
        result = analyze_description(SHORT_DESCRIPTION)

        # Assert
        assert result["score"] < 50

    def test_short_description_flags_length_issue(self):
        # Act
        result = analyze_description(SHORT_DESCRIPTION)

        # Assert
        assert any("length" in issue.lower() or "short" in issue.lower() for issue in result["issues"])

    def test_well_formed_description_scores_higher_than_short_one(self):
        # Arrange
        short_result = analyze_description(SHORT_DESCRIPTION)

        # Act
        well_formed_result = analyze_description(WELL_FORMED_DESCRIPTION)

        # Assert
        assert well_formed_result["score"] > short_result["score"]

    def test_well_formed_description_has_no_length_issue(self):
        result = analyze_description(WELL_FORMED_DESCRIPTION)
        assert not any("too short" in issue.lower() for issue in result["issues"])

    def test_empty_description_raises_value_error(self):
        import pytest

        with pytest.raises(ValueError):
            analyze_description("")

    def test_none_description_raises_value_error(self):
        import pytest

        with pytest.raises(ValueError):
            analyze_description(None)

    def test_result_contains_suggestions_for_low_score(self):
        result = analyze_description(SHORT_DESCRIPTION)
        assert len(result["suggestions"]) > 0

    def test_score_is_between_zero_and_hundred(self):
        result = analyze_description(WELL_FORMED_DESCRIPTION)
        assert 0 <= result["score"] <= 100

    def test_keyword_stuffed_description_flags_density_issue(self):
        # Arrange: same word repeated excessively
        stuffed = "shoe shoe shoe shoe shoe shoe shoe shoe shoe shoe running shoe"

        # Act
        result = analyze_description(stuffed)

        # Assert
        assert any("keyword" in issue.lower() or "density" in issue.lower() for issue in result["issues"])


class TestFallbackReadabilityWithoutTextstat:
    """Covers the self-contained Flesch approximation used when `textstat`
    (or its `pkg_resources` dependency) is unavailable in the environment."""

    def test_well_formed_description_still_scores_without_textstat(self):
        # Arrange: force the no-textstat code path regardless of whether
        # textstat is actually installed in this environment.
        with patch.object(description_analyzer, "_HAS_TEXTSTAT", False):
            # Act
            result = analyze_description(WELL_FORMED_DESCRIPTION)

        # Assert
        assert 0 <= result["score"] <= 100

    def test_short_description_still_flags_length_without_textstat(self):
        with patch.object(description_analyzer, "_HAS_TEXTSTAT", False):
            result = analyze_description(SHORT_DESCRIPTION)

        assert result["score"] < 50
        assert any("length" in issue.lower() or "short" in issue.lower() for issue in result["issues"])

    def test_flesch_approximation_handles_single_long_word(self):
        # Exercises the syllable-counting heuristic and the "word.endswith('e')" branch.
        with patch.object(description_analyzer, "_HAS_TEXTSTAT", False):
            result = analyze_description(
                "Comprehensive extensible maintainable software architecture "
                "documentation improves onboarding, reduces technical debate, "
                "encourages consistent naming, and enables sustainable teamwork."
            )

        assert 0 <= result["score"] <= 100
