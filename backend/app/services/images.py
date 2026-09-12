"""Making uploaded images smaller, in the sizes a browser actually wants.

An upload has been stored exactly as it arrived. The admin console resizes and
re-encodes in the browser before sending, so most files are already reasonable
-- but "most" is doing real work there: the heaviest asset on the live homepage
is a 1.9 MB PNG that predates that pipeline, roughly twelve times the next
largest thing on the page. And every file, however well-encoded, is served at
one size to every device, so a phone downloads the desktop image.

This generates a handful of widths per upload as WebP. Deliberately **not**
AVIF: the deployed Pillow is 11.0, which has no AVIF support at all, and
getting it would mean upgrading a library that also backs barcode and QR
generation. AVIF buys perhaps 20-30% over WebP, which is not worth touching
that dependency for the number of self-hosted images this shop has.

Nothing here is allowed to fail an upload. A derivative is an optimisation; if
one cannot be produced -- an animated GIF, a corrupt frame, a format Pillow
will not resize -- the original still works and the browser still gets it.
"""
from __future__ import annotations

import logging
from pathlib import Path

from PIL import Image, UnidentifiedImageError

logger = logging.getLogger(__name__)

#: The widths worth having. Chosen against how the storefront lays out:
#: tiles and swatches sit around 400 CSS px, product and editorial images
#: around 800, and the hero runs to 1200 on a wide screen. More widths would
#: mean more encoding for differences a viewer cannot see.
DERIVATIVE_WIDTHS: tuple[int, ...] = (400, 800, 1200)

#: WebP is generated, never anything else. See the module docstring.
DERIVATIVE_SUFFIX = ".webp"

#: 82 sits at the point where artefacts stop being visible on photographs at
#: these sizes; the client-side pipeline already uses the same figure, so an
#: image that went through both does not get quietly degraded twice.
WEBP_QUALITY = 82

#: A decompression guard. A 20,000 x 20,000 PNG is a few hundred KB on the
#: wire and 1.2 GB decoded, which on a 2 vCPU box with 3.8 GB of RAM is an
#: out-of-memory kill for the whole API, not a failed upload. Pillow's own
#: default limit is both higher and only a warning.
MAX_PIXELS = 40_000_000

#: Below this there is nothing to gain: a derivative would be the same size as
#: the original, or larger once WebP's header is counted.
MIN_SOURCE_WIDTH = 320


def derivative_name(stored_name: str, width: int) -> str:
    """The filename a derivative of `stored_name` is stored under.

    Encoded in the name rather than a directory or a database row because the
    name is the only identifier this store has -- there is no media table, and
    `_to_item` in the router rebuilds everything it knows from the filename.
    """
    return f"{Path(stored_name).stem}__w{width}{DERIVATIVE_SUFFIX}"


def is_derivative(stored_name: str) -> bool:
    """Whether a file is something this module generated.

    Used to keep derivatives out of the media library listing: an admin
    browsing their photos should see the four they uploaded, not sixteen.
    """
    stem = Path(stored_name).stem
    if "__w" not in stem:
        return False
    suffix = stem.rsplit("__w", 1)[1]
    # Only the widths this module actually produces. Matching any number would
    # hide a file somebody genuinely named "swatch__w2.png" from their own
    # media library, with nothing on screen to explain where it went.
    return suffix.isdigit() and int(suffix) in DERIVATIVE_WIDTHS


def build_derivatives(directory: Path, stored_name: str) -> list[int]:
    """Generate the WebP widths for one stored file. Returns the widths made.

    Never raises. Every failure path here ends with the original still being
    the thing the browser gets, which is exactly the behaviour before this
    module existed.
    """
    source = directory / stored_name
    if not source.is_file() or is_derivative(stored_name):
        return []

    try:
        with Image.open(source) as image:
            if image.width * image.height > MAX_PIXELS:
                logger.warning(
                    "Skipping derivatives for %s: %dx%d exceeds the pixel budget",
                    stored_name, image.width, image.height,
                )
                return []
            if getattr(image, "n_frames", 1) > 1:
                # Animated. Resizing would keep the first frame and silently
                # throw the animation away, which is a worse outcome than a
                # larger file.
                return []
            if image.width < MIN_SOURCE_WIDTH:
                return []

            # Flattened onto white rather than kept as RGBA: a transparent PNG
            # saved to WebP keeps its alpha, but the common case here is a
            # photograph, and converting once up front avoids a per-width
            # mode conversion.
            prepared = image.convert("RGB") if image.mode not in ("RGB", "RGBA") else image

            made: list[int] = []
            for width in DERIVATIVE_WIDTHS:
                # No upscaling. A 500px original has nothing to offer a 1200px
                # slot except a bigger file that looks the same.
                if width >= prepared.width:
                    continue
                height = round(prepared.height * width / prepared.width)
                resized = prepared.resize((width, height), Image.LANCZOS)
                resized.save(
                    directory / derivative_name(stored_name, width),
                    format="WEBP",
                    quality=WEBP_QUALITY,
                    method=4,
                )
                made.append(width)
            return made
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        logger.warning("Could not build derivatives for %s: %s", stored_name, exc)
        return []


def existing_widths(directory: Path, stored_name: str) -> list[int]:
    """Which derivative widths are already on disk for this file."""
    return sorted(
        width
        for width in DERIVATIVE_WIDTHS
        if (directory / derivative_name(stored_name, width)).is_file()
    )


def remove_derivatives(directory: Path, stored_name: str) -> int:
    """Delete a file's derivatives. Returns how many went.

    Called when the original is deleted. Without it the store accumulates
    orphans that nothing lists and nothing will ever clean up.
    """
    removed = 0
    for width in DERIVATIVE_WIDTHS:
        path = directory / derivative_name(stored_name, width)
        if path.is_file():
            path.unlink()
            removed += 1
    return removed
