"""Keyword-density scoring (most-frequent-word ratio)."""

_MAX_KEYWORD_DENSITY = 0.25  # a single word should not exceed 25% of all words


def check_keyword_density(words: list[str]) -> tuple[int, list[str], list[str]]:
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
