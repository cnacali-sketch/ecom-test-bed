"""Tests for /api/media (admin file uploads).

The upload's own Content-Type header and filename extension are both
attacker-controlled, and StaticFiles serves by extension -- these tests
prove the endpoint decides by decoding actual bytes, never by trusting
either of those.
"""
import io

import pytest
from httpx import AsyncClient
from PIL import Image

from app.routers.media import UPLOAD_DIR


@pytest.fixture(autouse=True)
def _cleanup_uploaded_files():
    """media.py has no DB -- successful uploads land as real files on disk
    (UPLOAD_DIR is bind-mounted from the host in dev). Remove whatever this
    test session wrote so repeat runs don't accumulate test images."""
    before = set(UPLOAD_DIR.iterdir()) if UPLOAD_DIR.exists() else set()
    yield
    after = set(UPLOAD_DIR.iterdir()) if UPLOAD_DIR.exists() else set()
    for path in after - before:
        path.unlink(missing_ok=True)


def _png_bytes() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (2, 2), color="red").save(buf, format="PNG")
    return buf.getvalue()


@pytest.mark.asyncio
async def test_upload_requires_admin(customer_client: AsyncClient) -> None:
    resp = await customer_client.post(
        "/api/media",
        files={"file": ("photo.png", _png_bytes(), "image/png")},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_upload_accepts_a_real_image_and_derives_its_own_extension(
    admin_client: AsyncClient,
) -> None:
    resp = await admin_client.post(
        "/api/media",
        files={"file": ("photo.whatever", _png_bytes(), "image/png")},
    )
    assert resp.status_code == 201
    data = resp.json()
    # Extension comes from the verified PNG bytes, not the client's ".whatever".
    assert data["url"].endswith(".png")
    assert data["name"].endswith(".png")


@pytest.mark.asyncio
async def test_upload_rejects_script_content_disguised_as_an_image(
    admin_client: AsyncClient,
) -> None:
    """The exact attack this closes: real content is HTML/script, but the
    Content-Type header AND filename both claim it's a harmless image."""
    payload = b"<html><body><script>alert(document.cookie)</script></body></html>"
    resp = await admin_client.post(
        "/api/media",
        files={"file": ("evil.png", payload, "image/png")},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_upload_rejects_svg_even_with_genuine_svg_content(
    admin_client: AsyncClient,
) -> None:
    """SVG can embed <script> and this library has no sanitizer -- excluded
    outright, even for an SVG that decodes as genuinely well-formed SVG."""
    svg = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
    resp = await admin_client.post(
        "/api/media",
        files={"file": ("logo.svg", svg, "image/svg+xml")},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_upload_rejects_oversized_file(admin_client: AsyncClient) -> None:
    oversized = b"0" * (8 * 1024 * 1024 + 1)
    resp = await admin_client.post(
        "/api/media",
        files={"file": ("big.png", oversized, "image/png")},
    )
    assert resp.status_code == 422
