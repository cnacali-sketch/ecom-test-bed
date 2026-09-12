"""Tests for /api/media (admin file uploads).

The upload's own Content-Type header and filename extension are both
attacker-controlled, and StaticFiles serves by extension -- these tests
prove the endpoint decides by decoding actual bytes, never by trusting
either of those.
"""
import io
import re

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


def _webp_bytes() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (2, 2), color="teal").save(buf, format="WEBP")
    return buf.getvalue()


@pytest.mark.asyncio
async def test_uploaded_webp_is_served_as_an_image_not_text(
    admin_client: AsyncClient,
) -> None:
    """The static mount must label WebP as image/webp.

    Regression test for a bug that reached production. StaticFiles takes the
    Content-Type from Python's `mimetypes`, which reads the OS table. The slim
    container image ships no /etc/mime.types and that Python's built-in table
    has no .webp entry, so every uploaded WebP went out as
    "text/plain; charset=utf-8". With X-Content-Type-Options: nosniff set at
    the edge the browser refused to render it, and since the admin's crop
    editor emits WebP exclusively, every image uploaded through it appeared
    broken -- in the media library and on the storefront.
    """
    upload = await admin_client.post(
        "/api/media",
        files={"file": ("photo.webp", _webp_bytes(), "image/webp")},
    )
    assert upload.status_code == 201
    url = upload.json()["url"]
    assert url.endswith(".webp")

    served = await admin_client.get(url)

    assert served.status_code == 200
    assert served.headers["content-type"] == "image/webp"


@pytest.mark.asyncio
async def test_uploaded_png_is_served_as_an_image(admin_client: AsyncClient) -> None:
    """The PNG counterpart, which worked all along -- kept so a future change
    to the mount cannot quietly break the format that was never affected."""
    upload = await admin_client.post(
        "/api/media",
        files={"file": ("photo.png", _png_bytes(), "image/png")},
    )
    assert upload.status_code == 201

    served = await admin_client.get(upload.json()["url"])

    assert served.status_code == 200
    assert served.headers["content-type"] == "image/png"


# ---------------------------------------------------------------------------
# Responsive derivatives
# ---------------------------------------------------------------------------


def _big_png(size=(1600, 2000)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color="teal").save(buf, format="PNG")
    return buf.getvalue()


@pytest.mark.asyncio
async def test_an_upload_reports_the_widths_it_generated(admin_client: AsyncClient) -> None:
    """Reported in the response, not discovered later.

    Generated before responding rather than in the background, because a
    caller that rendered a srcset for a derivative still being written would
    request a file that is not on disk yet.
    """
    resp = await admin_client.post(
        "/api/media", files={"file": ("wide.png", _big_png(), "image/png")}
    )

    assert resp.status_code == 201
    assert resp.json()["widths"] == [400, 800, 1200]


@pytest.mark.asyncio
async def test_a_small_upload_reports_no_widths_and_still_succeeds(
    admin_client: AsyncClient,
) -> None:
    """A derivative is an optimisation. Nothing here may fail an upload."""
    resp = await admin_client.post(
        "/api/media", files={"file": ("tiny.png", _png_bytes(), "image/png")}
    )

    assert resp.status_code == 201
    assert resp.json()["widths"] == []


@pytest.mark.asyncio
async def test_the_library_lists_photos_not_their_derivatives(
    admin_client: AsyncClient,
) -> None:
    """Otherwise uploading four images shows sixteen entries, with no way to
    tell which is the one you uploaded."""
    await admin_client.post("/api/media", files={"file": ("wide.png", _big_png(), "image/png")})

    listed = (await admin_client.get("/api/media")).json()

    # Matched on the real pattern, not on the substring "__w". The upload in
    # this test is stored as "<uuid>__wide.png", which contains "__w" and is
    # emphatically not a derivative -- exactly the false positive the width
    # check in is_derivative exists to avoid.
    assert not any(re.search(r"__w\d+\.webp$", item["id"]) for item in listed)
    assert any(item["widths"] for item in listed)


@pytest.mark.asyncio
async def test_a_photo_whose_own_name_starts_with_w_is_not_hidden(
    admin_client: AsyncClient,
) -> None:
    """"wide.png" is stored as "<uuid>__wide.png". Treating any "__w" as a
    generated file would make it vanish from the library the moment it was
    uploaded, with nothing on screen to say why."""
    created = (
        await admin_client.post(
            "/api/media", files={"file": ("wide.png", _big_png(), "image/png")}
        )
    ).json()

    listed = (await admin_client.get("/api/media")).json()

    assert created["id"] in [item["id"] for item in listed]


@pytest.mark.asyncio
async def test_deleting_a_photo_removes_its_derivatives_too(
    admin_client: AsyncClient,
) -> None:
    created = (
        await admin_client.post(
            "/api/media", files={"file": ("wide.png", _big_png(), "image/png")}
        )
    ).json()
    stem = created["id"].rsplit(".", 1)[0]

    await admin_client.delete(f"/api/media/{created['id']}")

    leftovers = [p.name for p in UPLOAD_DIR.iterdir() if p.name.startswith(stem)]
    assert leftovers == []


@pytest.mark.asyncio
async def test_the_backfill_generates_widths_for_an_older_upload(
    admin_client: AsyncClient,
) -> None:
    """The store has no record of when a file arrived, and the heaviest asset
    on the live homepage predates both the browser-side resizing and this
    endpoint."""
    legacy = UPLOAD_DIR / "legacy-upload.png"
    legacy.write_bytes(_big_png())

    resp = await admin_client.post("/api/media/optimize")

    assert resp.status_code == 200
    body = resp.json()
    assert body["processed"] >= 1
    assert body["bytes_after_largest"] < body["bytes_before"]
    assert (UPLOAD_DIR / "legacy-upload__w800.webp").is_file()


@pytest.mark.asyncio
async def test_running_the_backfill_twice_is_harmless(admin_client: AsyncClient) -> None:
    """It is the kind of button an admin presses again when unsure."""
    (UPLOAD_DIR / "legacy-twice.png").write_bytes(_big_png())
    await admin_client.post("/api/media/optimize")

    second = (await admin_client.post("/api/media/optimize")).json()

    assert second["processed"] == 0
    assert second["skipped"] >= 1


@pytest.mark.asyncio
async def test_the_backfill_is_admin_only(client: AsyncClient) -> None:
    assert (await client.post("/api/media/optimize")).status_code == 401


# ---------------------------------------------------------------------------
# Serving a derivative that was never generated
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_a_missing_derivative_serves_the_original(sync_client) -> None:
    """The storefront's loader rewrites every /media URL into a derivative,
    because it runs in the browser and cannot know which files have them.

    A missing candidate in a srcset is not a soft failure -- the browser
    renders a broken image rather than falling back to `src`. So the fallback
    has to happen here, where the filesystem is.
    """
    (UPLOAD_DIR / "no-derivatives.png").write_bytes(_png_bytes())

    resp = sync_client.get("/media/no-derivatives__w800.webp")

    assert resp.status_code == 200
    assert resp.content == _png_bytes()


@pytest.mark.asyncio
async def test_a_real_derivative_is_served_in_preference_to_the_original(
    admin_client: AsyncClient, sync_client
) -> None:
    created = (
        await admin_client.post(
            "/api/media", files={"file": ("wide.png", _big_png(), "image/png")}
        )
    ).json()
    stem = created["id"].rsplit(".", 1)[0]

    resp = sync_client.get(f"/media/{stem}__w400.webp")

    assert resp.status_code == 200
    assert resp.content != _big_png()
    assert len(resp.content) < len(_big_png())


@pytest.mark.asyncio
async def test_a_genuinely_missing_file_is_still_a_404(sync_client) -> None:
    """The fallback must not turn every typo into a 200."""
    assert sync_client.get("/media/nothing-here__w800.webp").status_code == 404
    assert sync_client.get("/media/nothing-here.png").status_code == 404


@pytest.mark.asyncio
async def test_the_fallback_does_not_rescue_a_non_404(sync_client) -> None:
    """Only a missing file gets the fallback.

    StaticFiles also raises for a disallowed method. Treating every failure as
    "try the original" would turn a refusal into a served file.
    """
    (UPLOAD_DIR / "method-check.png").write_bytes(_png_bytes())

    resp = sync_client.post("/media/method-check__w800.webp")

    assert resp.status_code == 405
    assert resp.content != _png_bytes()


@pytest.mark.asyncio
async def test_a_width_that_is_not_a_number_is_not_treated_as_a_derivative(
    sync_client,
) -> None:
    """"photo__wide.webp" is a filename, not a request for a derivative. Without
    the digit check it would serve photo.png under a name that has nothing to
    do with it."""
    (UPLOAD_DIR / "photo.png").write_bytes(_png_bytes())

    assert sync_client.get("/media/photo__wide.webp").status_code == 404
