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

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel

from app.dependencies.auth import require_admin

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


def _to_item(path: Path) -> MediaItem:
    # Stored as "<uuid>__<original-name>"; id is the filename itself so
    # DELETE can address it directly with no lookup table.
    original_name = path.name.split("__", 1)[1] if "__" in path.name else path.name
    return MediaItem(id=path.name, name=original_name, url=f"/media/{path.name}", size=path.stat().st_size)


@router.get("", response_model=list[MediaItem])
async def list_media() -> list[MediaItem]:
    files = sorted(UPLOAD_DIR.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True)
    return [_to_item(f) for f in files if f.is_file()]


@router.post("", response_model=MediaItem, status_code=201)
async def upload_media(file: UploadFile) -> MediaItem:
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
    return _to_item(UPLOAD_DIR / stored_name)


@router.delete("/{media_id}", status_code=204)
async def delete_media(media_id: str) -> None:
    # media_id is a filename we generated (uuid__name) — reject anything that
    # could escape UPLOAD_DIR via path separators before it ever touches disk.
    if "/" in media_id or "\\" in media_id or ".." in media_id:
        raise HTTPException(status_code=422, detail="Invalid media id")
    path = UPLOAD_DIR / media_id
    if not path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    path.unlink()
