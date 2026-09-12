"""The site's content, as a document.

  GET /api/content/{key}  — the whole document (public: a storefront renders
                            from this, so it cannot require a session)
  PUT /api/content/{key}  — replace it (admin, audited, version-checked)

This is the endpoint that makes the backend reusable. Everything a storefront
needs to render -- brand, navigation, footer, policy copy, homepage content,
SEO defaults -- comes back in one response, so a second frontend can be written
against the API instead of against a copy of somebody else's config file.

`GET /api/sections` still exists and still returns the old flat homepage shape,
because the storefront in this repo reads it on every render. It is now a
projection of this document rather than a table of its own.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db_session
from app.dependencies.auth import require_admin
from app.models.site_content import SITE_KEY, SiteContent
from app.models.user import User
from app.services import audit
from app.services.site_content import defaults

router = APIRouter(prefix="/api/content", tags=["content"])

# Keys the API will serve. An allow-list rather than free-form: the path
# segment reaches a primary key, and without this any string would create a
# row on first read, so a crawler hitting /api/content/wp-admin would quietly
# fill the table.
KNOWN_KEYS = {SITE_KEY}

# A document is words and pictures, not a payload. This cap is generous for
# the real one (about 22 KB) and still refuses an upload that is trying to be
# storage rather than content.
MAX_DOCUMENT_BYTES = 512 * 1024


class ContentRead(BaseModel):
    key: str
    version: int
    updated_at: datetime | None = None
    document: dict[str, Any]


class ContentWrite(BaseModel):
    document: dict[str, Any]
    #: The version the editor believed it was changing. Omitted means "save
    #: regardless"; supplied and stale means somebody else saved first.
    expected_version: int | None = Field(default=None, ge=1)


async def get_or_seed(db: AsyncSession, key: str) -> SiteContent:
    """The stored document, created from the packaged defaults if absent.

    Seeding on read rather than only in the migration keeps a freshly created
    database -- a new developer's, or the test suite's, which builds its schema
    straight from the models -- serving real content instead of an empty object
    that every consumer would then have to special-case.
    """
    row = (
        await db.execute(select(SiteContent).where(SiteContent.key == key))
    ).scalar_one_or_none()
    if row is not None:
        return row

    row = SiteContent(key=key, document=defaults() if key == SITE_KEY else {}, version=1)
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


def _require_known(key: str) -> None:
    if key not in KNOWN_KEYS:
        raise HTTPException(status_code=404, detail=f"No content document named '{key}'.")


@router.get("/{key}", response_model=ContentRead)
async def read_content(key: str, db: AsyncSession = Depends(get_db_session)) -> ContentRead:
    """The whole document. Public, because a storefront renders from it."""
    _require_known(key)
    row = await get_or_seed(db, key)
    return ContentRead(
        key=row.key, version=row.version, updated_at=row.updated_at, document=row.document
    )


@router.put("/{key}", response_model=ContentRead)
async def write_content(
    key: str,
    payload: ContentWrite,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    actor: User = Depends(require_admin),
) -> ContentRead:
    """Replace the document.

    A full replace, not a merge: the editor holds the whole document and sends
    back what it should now be. A merge would make deleting a nav entry or an
    FAQ impossible to express -- the absent key would read as "unchanged".
    """
    _require_known(key)

    import json

    size = len(json.dumps(payload.document).encode("utf-8"))
    if size > MAX_DOCUMENT_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"That document is {size // 1024} KB; the limit is {MAX_DOCUMENT_BYTES // 1024} KB.",
        )
    if not payload.document:
        # Saving an empty document would blank the storefront, and it is far
        # more likely to be a bug in whatever is calling than an intention.
        raise HTTPException(
            status_code=422,
            detail="Refusing to save an empty document — it would blank the storefront.",
        )

    row = await get_or_seed(db, key)
    if payload.expected_version is not None and payload.expected_version != row.version:
        raise HTTPException(
            status_code=409,
            detail=(
                f"This content was changed by somebody else (you had version "
                f"{payload.expected_version}, it is now {row.version}). "
                "Reload before saving so their change is not lost."
            ),
        )

    changed = sorted(
        key_name
        for key_name in set(row.document) | set(payload.document)
        if row.document.get(key_name) != payload.document.get(key_name)
    )
    row.document = payload.document
    row.version += 1

    await audit.record(
        db,
        actor=actor,
        request=request,
        action="content.update",
        entity_type="content",
        entity_label=key,
        summary=(
            f"Edited site content: {', '.join(changed)}" if changed else "Saved site content"
        ),
        # The sections themselves, not their contents. A diff of the whole
        # document would put 22 KB of copy in the audit log on every save and
        # bury the entries that say who refunded what.
        changes={"sections": {"from": None, "to": changed}, "version": {
            "from": row.version - 1, "to": row.version}},
    )
    await db.commit()
    await db.refresh(row)
    return ContentRead(
        key=row.key, version=row.version, updated_at=row.updated_at, document=row.document
    )
