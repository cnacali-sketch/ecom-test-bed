"""Media library endpoints — admin file uploads, persisted to disk and
served statically (mounted at /media in main.py). No DB table: the upload
directory itself is the source of truth (filename = id), which is enough
for a flat media library and avoids a metadata table that could drift out
of sync with what's actually on disk.

  GET    /api/media       — list uploaded files (admin)
  POST   /api/media        — upload a file (admin)
  DELETE /api/media/{id}   — delete a file (admin)
"""
import io
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel

from app.db import get_db_session
from app.dependencies.auth import require_admin
from app.models.user import User
from app.services import audit, images

router = APIRouter(prefix="/api/media", tags=["media"], dependencies=[Depends(require_admin)])

UPLOAD_DIR = Path(__file__).resolve().parents[2] / "media_uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Images only — this is a product/homepage image library, not a general file
# store, and an unrestricted upload endpoint is a real attack surface. The
# upload's own Content-Type header and filename extension are both
# attacker-controlled (a script-bearing file can claim to be image/png), and
# StaticFiles serves by extension — so neither is trusted. Pillow decodes the
# actual bytes; the verified format is what decides the stored extension.
# SVG is deliberately excluded even though it's an image format: it can embed
# <script>, and this library has no sanitizer for that.
ALLOWED_FORMATS = {"JPEG": ".jpg", "PNG": ".png", "WEBP": ".webp", "GIF": ".gif"}
MAX_UPLOAD_BYTES = 8 * 1024 * 1024


class MediaItem(BaseModel):
    id: str
    name: str
    url: str
    size: int
    #: Widths available as WebP alongside the original, smallest first. Empty
    #: when the file is too small to be worth resizing, is animated, or could
    #: not be decoded -- in every one of those cases the original is still
    #: served and still works.
    widths: list[int] = []


def _to_item(path: Path) -> MediaItem:
    # Stored as "<uuid>__<original-name>"; id is the filename itself so
    # DELETE can address it directly with no lookup table.
    original_name = path.name.split("__", 1)[1] if "__" in path.name else path.name
    return MediaItem(
        id=path.name,
        name=original_name,
        url=f"/media/{path.name}",
        size=path.stat().st_size,
        widths=images.existing_widths(UPLOAD_DIR, path.name),
    )


@router.get("", response_model=list[MediaItem])
async def list_media() -> list[MediaItem]:
    files = sorted(UPLOAD_DIR.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True)
    # Derivatives are filtered out: they are the same photographs at other
    # sizes, and listing them would turn a library of four images into one of
    # sixteen with no way to tell which is which.
    return [
        _to_item(f) for f in files if f.is_file() and not images.is_derivative(f.name)
    ]


@router.post("", response_model=MediaItem, status_code=201)
async def upload_media(
    file: UploadFile,
    request: Request,
    # This router is otherwise filesystem-only; the session exists purely so
    # the upload can be recorded. Photos are how a product is represented to a
    # customer, and a swapped one is a change worth being able to trace.
    db: AsyncSession = Depends(get_db_session),
    actor: User = Depends(require_admin),
) -> MediaItem:
    contents = await file.read()
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=422, detail="File exceeds 8MB limit")

    try:
        with Image.open(io.BytesIO(contents)) as img:
            img.verify()
            image_format = img.format
    except (UnidentifiedImageError, OSError):
        raise HTTPException(status_code=422, detail="File is not a valid image")

    extension = ALLOWED_FORMATS.get(image_format or "")
    if extension is None:
        raise HTTPException(status_code=422, detail=f"Unsupported image type: {image_format}")

    # .stem drops both any path components and the client's own extension —
    # the stored extension always comes from the verified format above, never
    # from the upload's filename or Content-Type.
    original_stem = Path(file.filename or "upload").stem
    stored_name = f"{uuid.uuid4()}__{original_stem}{extension}"
    (UPLOAD_DIR / stored_name).write_bytes(contents)
    # Generated before responding rather than in the background. The response
    # carries the widths, and a caller that rendered a srcset for a derivative
    # still being written would ask for a file that is not there yet. WebP at
    # these sizes is fast enough that an admin will not notice, and a failure
    # returns an empty list rather than raising -- the original still serves.
    images.build_derivatives(UPLOAD_DIR, stored_name)
    await audit.record(
        db,
        actor=actor,
        request=request,
        action="media.upload",
        entity_type="media",
        entity_label=stored_name,
        summary=f"Uploaded {original_stem}{extension} ({len(contents) // 1024} KB)",
    )
    await db.commit()
    return _to_item(UPLOAD_DIR / stored_name)


@router.delete("/{media_id}", status_code=204)
async def delete_media(
    media_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    actor: User = Depends(require_admin),
) -> None:
    # media_id is a filename we generated (uuid__name) — reject anything that
    # could escape UPLOAD_DIR via path separators before it ever touches disk.
    if "/" in media_id or "\\" in media_id or ".." in media_id:
        raise HTTPException(status_code=422, detail="Invalid media id")
    path = UPLOAD_DIR / media_id
    if not path.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    # Committed before the file is removed. The two cannot be made atomic - one
    # is a filesystem call and the other a transaction - so the order is chosen
    # deliberately: a log entry for a delete that then failed is a false alarm
    # somebody can check, while a deleted file with no entry is the silent loss
    # this table exists to prevent.
    await audit.record(
        db,
        actor=actor,
        request=request,
        action="media.delete",
        entity_type="media",
        entity_label=media_id,
        summary=f"Deleted {media_id}",
    )
    await db.commit()
    path.unlink()
    # Orphans otherwise: nothing lists them and nothing would ever clean up.
    images.remove_derivatives(UPLOAD_DIR, media_id)


class OptimiseResult(BaseModel):
    processed: int
    skipped: int
    widths_created: int
    bytes_before: int
    bytes_after_largest: int


@router.post("/optimize", response_model=OptimiseResult)
async def optimize_library(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    actor: User = Depends(require_admin),
) -> OptimiseResult:
    """Generate the missing derivatives for images uploaded before this existed.

    Needed because the store has no record of when a file arrived, and the
    heaviest asset on the live homepage is a PNG that predates both the
    browser-side resizing and this endpoint. Running it twice is harmless:
    anything that already has its widths is skipped.

    Synchronous and admin-only. It walks a handful of files on a two-core box,
    so it finishes in the time an admin will wait; making it a background job
    would need a worker this deployment deliberately does not run.
    """
    processed = skipped = widths_created = 0
    bytes_before = bytes_after_largest = 0

    for path in sorted(UPLOAD_DIR.iterdir()):
        if not path.is_file() or images.is_derivative(path.name):
            continue
        if images.existing_widths(UPLOAD_DIR, path.name):
            skipped += 1
            continue

        made = images.build_derivatives(UPLOAD_DIR, path.name)
        if not made:
            skipped += 1
            continue

        processed += 1
        widths_created += len(made)
        bytes_before += path.stat().st_size
        largest = UPLOAD_DIR / images.derivative_name(path.name, max(made))
        bytes_after_largest += largest.stat().st_size if largest.is_file() else 0

    await audit.record(
        db,
        actor=actor,
        request=request,
        action="media.optimize",
        entity_type="media",
        entity_label="library",
        summary=(
            f"Generated {widths_created} sizes for {processed} image"
            f"{'' if processed == 1 else 's'}"
        ),
        changes={"processed": {"from": None, "to": processed}},
    )
    await db.commit()

    return OptimiseResult(
        processed=processed,
        skipped=skipped,
        widths_created=widths_created,
        bytes_before=bytes_before,
        bytes_after_largest=bytes_after_largest,
    )
