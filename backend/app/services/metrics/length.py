"""Description length scoring (word count)."""

_MIN_WORD_COUNT = 20


def check_length(words: list[str]) -> tuple[int, list[str], list[str]]:
    """Score description length; return (points_out_of_40, issues, suggestions)."""
    word_count = len(words)
    if word_count < _MIN_WORD_COUNT:
        issues = [f"Description is too short ({word_count} words); aim for at least {_MIN_WORD_COUNT}."]
        suggestions = ["Expand the description with product benefits, materials, and use cases."]
        points = round(40 * (word_count / _MIN_WORD_COUNT))
        return points, issues, suggestions
    return 40, [], []
