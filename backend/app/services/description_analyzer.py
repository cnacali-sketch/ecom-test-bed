"""Heuristic scoring of product description text for LLM/recommendation readiness.

No LLM call is made -- this is a pure, standalone heuristic:
  1. Length check (word count)
  2. Keyword density (most-frequent-word ratio)
  3. Readability (Flesch reading ease, via `textstat` if importable, else a
     self-contained Flesch approximation)

Designed to work even if `textstat` (or its `pkg_resources` dependency) is
unavailable in the runtime environment.
"""
import re

try:
    import textstat as _textstat

    _HAS_TEXTSTAT = True
except ImportError:
    _HAS_TEXTSTAT = False

_MIN_WORD_COUNT = 20
_MAX_KEYWORD_DENSITY = 0.25  # a single word should not exceed 25% of all words
_WORD_RE = re.compile(r"[A-Za-z']+")
_SENTENCE_END_RE = re.compile(r"[.!?]+")


def _split_words(text: str) -> list[str]:
    """Return lowercase word tokens from `text`."""
    return [match.lower() for match in _WORD_RE.findall(text)]


def _count_syllables(word: str) -> int:
    """Approximate syllable count for a single word (vowel-group heuristic)."""
    word = word.lower()
    vowel_groups = re.findall(r"[aeiouy]+", word)
    count = len(vowel_groups)
    if word.endswith("e") and count > 1:
        count -= 1
    return max(count, 1)


def _flesch_reading_ease_approx(text: str, words: list[str]) -> float:
    """Compute a simple Flesch Reading Ease approximation without `textstat`."""
    sentence_count = max(len(_SENTENCE_END_RE.findall(text)), 1)
    word_count = max(len(words), 1)
    syllable_count = sum(_count_syllables(word) for word in words) or 1

    words_per_sentence = word_count / sentence_count
    syllables_per_word = syllable_count / word_count

    return 206.835 - (1.015 * words_per_sentence) - (84.6 * syllables_per_word)


def _readability_score(text: str, words: list[str]) -> float:
    """Return the Flesch reading ease score, preferring `textstat` if available."""
    if _HAS_TEXTSTAT:
        return _textstat.flesch_reading_ease(text)
    return _flesch_reading_ease_approx(text, words)


def _check_length(words: list[str]) -> tuple[int, list[str], list[str]]:
    """Score description length; return (points_out_of_40, issues, suggestions)."""
    word_count = len(words)
    if word_count < _MIN_WORD_COUNT:
        issues = [f"Description is too short ({word_count} words); aim for at least {_MIN_WORD_COUNT}."]
        suggestions = ["Expand the description with product benefits, materials, and use cases."]
        points = round(40 * (word_count / _MIN_WORD_COUNT))
        return points, issues, suggestions
    return 40, [], []


def _check_keyword_density(words: list[str]) -> tuple[int, list[str], list[str]]:
    """Score keyword density; return (points_out_of_30, issues, suggestions)."""
    if not words:
        return 0, [], []

    word_counts: dict[str, int] = {}
    for word in words:
        word_counts[word] = word_counts.get(word, 0) + 1

    most_common_word, most_common_count = max(word_counts.items(), key=lambda item: item[1])
    density = most_common_count / len(words)

    if density > _MAX_KEYWORD_DENSITY:
        issues = [
            f"Keyword density too high: '{most_common_word}' makes up "
            f"{density:.0%} of the text (keyword stuffing)."
        ]
        suggestions = ["Vary vocabulary and use synonyms instead of repeating the same keyword."]
        return 10, issues, suggestions

    return 30, [], []


def _check_readability(text: str, words: list[str]) -> tuple[int, list[str], list[str]]:
    """Score readability; return (points_out_of_30, issues, suggestions)."""
    flesch_score = _readability_score(text, words)

    if flesch_score < 30:
        issues = ["Text is difficult to read (low Flesch reading ease score)."]
        suggestions = ["Use shorter sentences and simpler words to improve readability."]
        return 10, issues, suggestions

    points = min(30, round(30 * (flesch_score / 60)))
    return max(points, 15), [], []


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

    length_points, length_issues, length_suggestions = _check_length(words)
    density_points, density_issues, density_suggestions = _check_keyword_density(words)
    readability_points, readability_issues, readability_suggestions = _check_readability(description, words)

    score = length_points + density_points + readability_points

    return {
        "score": max(0, min(100, score)),
        "issues": length_issues + density_issues + readability_issues,
        "suggestions": length_suggestions + density_suggestions + readability_suggestions,
    }
