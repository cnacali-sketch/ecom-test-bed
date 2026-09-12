"""Generating smaller copies of uploaded images.

The rule this module lives by is that it may never fail an upload. A
derivative is an optimisation, so every failure path -- an animated GIF, a
corrupt frame, an image large enough to exhaust the box -- has to end with the
original still stored and still served. A pipeline that rejects a photograph
because it could not shrink it has made the shop worse.
"""
import io

import pytest
from PIL import Image

from app.services import images


def _write(directory, name: str, size=(1600, 2000), mode="RGB", fmt="PNG") -> str:
    buf = io.BytesIO()
    Image.new(mode, size, color="teal").save(buf, format=fmt)
    (directory / name).write_bytes(buf.getvalue())
    return name


@pytest.fixture()
def media(tmp_path):
    return tmp_path


# --------------------------------------------------------------------------
# Generating
# --------------------------------------------------------------------------


def test_a_large_upload_gets_every_width(media):
    name = _write(media, "u__photo.png", size=(1600, 2000))

    made = images.build_derivatives(media, name)

    assert made == list(images.DERIVATIVE_WIDTHS)
    for width in images.DERIVATIVE_WIDTHS:
        assert (media / images.derivative_name(name, width)).is_file()


def test_the_derivatives_are_actually_smaller_than_the_original(media):
    """The whole point. A 1.9 MB PNG on the live homepage is what prompted this."""
    name = _write(media, "u__photo.png", size=(1600, 2000))
    original = (media / name).stat().st_size

    images.build_derivatives(media, name)

    largest = (media / images.derivative_name(name, 1200)).stat().st_size
    assert largest < original


def test_the_aspect_ratio_is_preserved(media):
    name = _write(media, "u__photo.png", size=(1600, 2000))

    images.build_derivatives(media, name)

    with Image.open(media / images.derivative_name(name, 400)) as out:
        assert out.size == (400, 500)


def test_nothing_is_upscaled(media):
    """A 500px original has nothing to offer a 1200px slot but a bigger file
    that looks identical."""
    name = _write(media, "u__small.png", size=(500, 500))

    made = images.build_derivatives(media, name)

    assert made == [400]
    assert not (media / images.derivative_name(name, 800)).exists()


def test_a_tiny_image_is_left_alone_entirely(media):
    """Below the floor a derivative is the same size or larger once WebP's
    header is counted."""
    name = _write(media, "u__tiny.png", size=(100, 100))

    assert images.build_derivatives(media, name) == []


# --------------------------------------------------------------------------
# Refusing to make things worse
# --------------------------------------------------------------------------


def test_an_animated_gif_is_skipped_rather_than_flattened(media):
    """Resizing keeps the first frame and silently discards the animation --
    a worse outcome than a large file, and one nobody would notice until a
    customer saw a still where a loop should be."""
    buf = io.BytesIO()
    frames = [Image.new("P", (600, 600), color=c) for c in (1, 2, 3)]
    frames[0].save(buf, format="GIF", save_all=True, append_images=frames[1:], duration=100)
    (media / "u__loop.gif").write_bytes(buf.getvalue())

    assert images.build_derivatives(media, "u__loop.gif") == []


def test_a_corrupt_file_returns_empty_instead_of_raising(media):
    """Called inline during upload. Raising here would turn a cosmetic failure
    into a failed upload."""
    (media / "u__broken.png").write_bytes(b"this is not an image")

    assert images.build_derivatives(media, "u__broken.png") == []


def test_a_missing_file_returns_empty_instead_of_raising(media):
    assert images.build_derivatives(media, "u__nope.png") == []


def test_an_image_beyond_the_pixel_budget_is_refused(media, monkeypatch):
    """A decompression guard, not a size guard.

    A 20,000 x 20,000 PNG is a few hundred KB on the wire and over a gigabyte
    decoded. On a 2 vCPU box with 3.8 GB of RAM that is an out-of-memory kill
    for the whole API, not a failed upload.
    """
    monkeypatch.setattr(images, "MAX_PIXELS", 1000)
    name = _write(media, "u__huge.png", size=(600, 600))

    assert images.build_derivatives(media, name) == []


def test_a_derivative_is_never_derived_again(media):
    """Otherwise every run of the backfill produces another generation of
    progressively smaller copies of copies."""
    name = _write(media, "u__photo.png")
    images.build_derivatives(media, name)

    child = images.derivative_name(name, 800)
    assert images.build_derivatives(media, child) == []


# --------------------------------------------------------------------------
# Naming and housekeeping
# --------------------------------------------------------------------------


def test_a_generated_file_is_recognised_as_one(media):
    assert images.is_derivative("u__photo__w400.webp") is True
    assert images.is_derivative("u__photo.png") is False


def test_a_file_a_person_named_that_way_is_not_mistaken_for_one(media):
    """Only the widths actually generated count. Matching any number would
    hide a file somebody named "swatch__w2.png" from their own library, with
    nothing on screen to explain where it went."""
    assert images.is_derivative("u__swatch__w2.png") is False


def test_existing_widths_reports_what_is_on_disk(media):
    name = _write(media, "u__photo.png")
    assert images.existing_widths(media, name) == []

    images.build_derivatives(media, name)

    assert images.existing_widths(media, name) == list(images.DERIVATIVE_WIDTHS)


def test_deleting_an_original_takes_its_derivatives_with_it(media):
    """Orphans otherwise: nothing lists them and nothing would ever clean up."""
    name = _write(media, "u__photo.png")
    images.build_derivatives(media, name)

    removed = images.remove_derivatives(media, name)

    assert removed == len(images.DERIVATIVE_WIDTHS)
    assert images.existing_widths(media, name) == []
