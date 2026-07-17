"""Heuristic scoring of product description text for LLM/recommendation readiness.

No LLM call is made -- this is a pure, standalone heuristic, coordinating three
isolated checks from `app.services.metrics`:
  1. Length (word count)
  2. Keyword density (most-frequent-word ratio)
  3. Readability (Flesch reading ease, via `textstat` if importable, else a
     self-contained Flesch approximation)

Designed to work even if `textstat` (or its `pkg_resources` dependency) is
unavailable in the runtime environment.
"""
import re

from app.services.metrics.keywords import check_keyword_density
from app.services.metrics.length import check_length
from app.services.metrics.readability import check_readability, flesch_reading_ease_approx

try:
    import textstat as _textstat

    _HAS_TEXTSTAT = True
except ImportError:
    _HAS_TEXTSTAT = False

_WORD_RE = re.compile(r"[A-Za-z']+")


def _split_words(text: str) -> list[str]:
    """Return lowercase word tokens from `text`."""
    return [match.lower() for match in _WORD_RE.findall(text)]


def _readability_score(text: str, words: list[str]) -> float:
    """Return the Flesch reading ease score, preferring `textstat` if available."""
    if _HAS_TEXTSTAT:
        return _textstat.flesch_reading_ease(text)
    return flesch_reading_ease_approx(text, words)


def analyze_description(description: str | None) -> dict:
    """Heuristically score a product description's LLM/recommendation readiness.

    Returns:
        dict with keys:
            score (int): 0-100 overall score.
            issues (list[str]): problems detected.
            suggestions (list[str]): actionable improvement tips.

    Raises:
        ValueError: if `description` is None or empty/whitespace-only.
    """
    if not description or not description.strip():
        raise ValueError("description must be a non-empty string")

    words = _split_words(description)

    length_points, length_issues, length_suggestions = check_length(words)
    density_points, density_issues, density_suggestions = check_keyword_density(words)
    flesch_score = _readability_score(description, words)
    readability_points, readability_issues, readability_suggestions = check_readability(flesch_score)

    score = length_points + density_points + readability_points

    return {
        "score": max(0, min(100, score)),
        "issues": length_issues + density_issues + readability_issues,
        "suggestions": length_suggestions + density_suggestions + readability_suggestions,
    }
