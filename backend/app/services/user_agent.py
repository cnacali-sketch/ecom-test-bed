"""Classify a raw User-Agent string into device, operating system and browser.

Deliberately a small pattern table rather than a UA-parsing dependency. These
labels exist so a shop owner can glance at an order and know roughly what the
buyer was using; they are not analytics-grade and nothing security-sensitive
depends on them. A User-Agent is client-supplied and trivially spoofed, so
treat every value here as a hint, never as fact.

Shared by the fraud/abuse summary (routers/events.py) and the admin Orders
screen so the two cannot drift into reporting different labels for the same
string.
"""
import re

# Order matters in all three tables: the first match wins, so the more
# specific pattern has to come first.
_DEVICE_PATTERNS = [
    ("Bot", re.compile(r"bot|crawler|spider|slurp", re.I)),
    ("Tablet", re.compile(r"ipad|tablet", re.I)),
    ("Mobile", re.compile(r"mobile|iphone|android", re.I)),
]

_OS_PATTERNS = [
    # iPadOS still reports "CPU OS 17_0 like Mac OS X" and contains "Mac OS X",
    # so every Apple mobile token has to be tested before macOS.
    ("iOS", re.compile(r"iphone|ipad|ipod|cpu os \d", re.I)),
    ("Android", re.compile(r"android", re.I)),
    ("Windows", re.compile(r"windows nt|win64|windows phone", re.I)),
    ("macOS", re.compile(r"macintosh|mac os x", re.I)),
    ("ChromeOS", re.compile(r"cros ", re.I)),
    # After Android, which also contains "Linux" in its UA string.
    ("Linux", re.compile(r"linux|x11|ubuntu", re.I)),
]

_BROWSER_PATTERNS = [
    # Edge and Opera both carry "Chrome/" in their UA, and Chrome carries
    # "Safari/", so this list runs most-specific first.
    ("Edge", re.compile(r"edg/", re.I)),
    ("Opera", re.compile(r"opr/|opera", re.I)),
    ("Samsung Internet", re.compile(r"samsungbrowser/", re.I)),
    ("Firefox", re.compile(r"firefox/|fxios/", re.I)),
    ("Chrome", re.compile(r"chrome/|crios/", re.I)),
    ("Safari", re.compile(r"safari/", re.I)),
]


def _first_match(patterns: list[tuple[str, re.Pattern]], value: str) -> str | None:
    for label, pattern in patterns:
        if pattern.search(value):
            return label
    return None


def classify_device(user_agent: str | None) -> str:
    """Mobile / Tablet / Desktop / Bot / Unknown."""
    if not user_agent:
        return "Unknown"
    return _first_match(_DEVICE_PATTERNS, user_agent) or "Desktop"


def classify_os(user_agent: str | None) -> str:
    """Windows / macOS / Android / iOS / Linux / ChromeOS / Unknown."""
    if not user_agent:
        return "Unknown"
    return _first_match(_OS_PATTERNS, user_agent) or "Unknown"


def classify_browser(user_agent: str | None) -> str:
    """Chrome / Safari / Firefox / Edge / Opera / Samsung Internet / Other."""
    if not user_agent:
        return "Unknown"
    return _first_match(_BROWSER_PATTERNS, user_agent) or "Other"


def describe(user_agent: str | None) -> str:
    """One line for the admin: "Android · Chrome (Mobile)".

    Returns "Unknown device" rather than an empty string so the Orders screen
    always has something to render — an order placed before User-Agent was
    recorded has no value at all, and a blank cell reads as a UI bug.
    """
    if not user_agent:
        return "Unknown device"
    os_name = classify_os(user_agent)
    browser = classify_browser(user_agent)
    device = classify_device(user_agent)
    return f"{os_name} · {browser} ({device})"
