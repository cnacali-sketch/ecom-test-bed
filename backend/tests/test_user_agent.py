"""Tests for the User-Agent classifier (app/services/user_agent.py).

Every string below is a real UA, kept verbatim. The point of these cases is
the overlaps: an Android UA also says "Linux", an iPad also says "Mac OS X",
Edge also says "Chrome", and Chrome also says "Safari" — so the ordering of
the pattern tables is the thing actually under test.
"""
import pytest

from app.services.user_agent import (
    classify_browser,
    classify_device,
    classify_os,
    describe,
)

ANDROID_CHROME = (
    "Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/126.0.0.0 Mobile Safari/537.36"
)
IPHONE_SAFARI = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
)
IPAD_SAFARI = (
    "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
)
WINDOWS_CHROME = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/126.0.0.0 Safari/537.36"
)
WINDOWS_EDGE = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0"
)
MAC_SAFARI = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/17.5 Safari/605.1.15"
)
GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"


@pytest.mark.parametrize(
    "user_agent,expected",
    [
        # "Linux; Android" — Linux must not win over Android.
        (ANDROID_CHROME, "Android"),
        # "CPU iPhone OS ... like Mac OS X" — macOS must not win over iOS.
        (IPHONE_SAFARI, "iOS"),
        (IPAD_SAFARI, "iOS"),
        (WINDOWS_CHROME, "Windows"),
        (MAC_SAFARI, "macOS"),
        (None, "Unknown"),
        ("", "Unknown"),
    ],
)
def test_classify_os(user_agent: str | None, expected: str) -> None:
    assert classify_os(user_agent) == expected


@pytest.mark.parametrize(
    "user_agent,expected",
    [
        # Both of these contain "Safari/", and Edge also contains "Chrome/".
        (WINDOWS_CHROME, "Chrome"),
        (WINDOWS_EDGE, "Edge"),
        (IPHONE_SAFARI, "Safari"),
        (None, "Unknown"),
    ],
)
def test_classify_browser(user_agent: str | None, expected: str) -> None:
    assert classify_browser(user_agent) == expected


@pytest.mark.parametrize(
    "user_agent,expected",
    [
        (ANDROID_CHROME, "Mobile"),
        (IPAD_SAFARI, "Tablet"),
        (WINDOWS_CHROME, "Desktop"),
        (GOOGLEBOT, "Bot"),
        (None, "Unknown"),
    ],
)
def test_classify_device(user_agent: str | None, expected: str) -> None:
    assert classify_device(user_agent) == expected


def test_describe_reads_as_one_line() -> None:
    assert describe(ANDROID_CHROME) == "Android · Chrome (Mobile)"
    assert describe(WINDOWS_EDGE) == "Windows · Edge (Desktop)"


def test_describe_never_returns_blank() -> None:
    """Orders placed before User-Agent was recorded have no value at all; an
    empty cell in the admin reads as a broken UI, not as missing data."""
    assert describe(None) == "Unknown device"
    assert describe("") == "Unknown device"
