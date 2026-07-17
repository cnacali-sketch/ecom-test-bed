"""Readability scoring (Flesch reading ease)."""
import re

_SENTENCE_END_RE = re.compile(r"[.!?]+")


def count_syllables(word: str) -> int:
    """Approximate syllable count for a single word (vowel-group heuristic)."""
    word = word.lower()
    vowel_groups = re.findall(r"[aeiouy]+", word)
    count = len(vowel_groups)
    if word.endswith("e") and count > 1:
        count -= 1
    return max(count, 1)


def flesch_reading_ease_approx(text: str, words: list[str]) -> float:
    """Compute a simple Flesch Reading Ease approximation without `textstat`."""
    sentence_count = max(len(_SENTENCE_END_RE.findall(text)), 1)
    word_count = max(len(words), 1)
    syllable_count = sum(count_syllables(word) for word in words) or 1

    words_per_sentence = word_count / sentence_count
    syllables_per_word = syllable_count / word_count

    return 206.835 - (1.015 * words_per_sentence) - (84.6 * syllables_per_word)


def check_readability(flesch_score: float) -> tuple[int, list[str], list[str]]:
    """Score readability from a precomputed Flesch score; return (points_out_of_30, issues, suggestions)."""
    if flesch_score < 30:
        issues = ["Text is difficult to read (low Flesch reading ease score)."]
        suggestions = ["Use shorter sentences and simpler words to improve readability."]
        return 10, issues, suggestions

    points = min(30, round(30 * (flesch_score / 60)))
    return max(points, 15), [], []
