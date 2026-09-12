"""Homepage content override endpoints.

  GET /api/sections  — the current override row, or all-null if the admin
                        has never saved one yet (public: the storefront's
                        homepage reads this on every render)
  PUT /api/sections   — replace the override (admin). A field sent as null
                        clears that override back to the site.config.ts
                        default; a field omitted from the payload is also
                        treated as null (this is a full-replace form, not a
                        partial patch, matching the single settings screen
                        that calls it).
"""
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db_session
from app.dependencies.auth import require_admin
from app.models.homepage_content import HomepageContent
from app.models.user import User
from app.services import audit

router = APIRouter(prefix="/api/sections", tags=["sections"])


class HomepageContentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    announcement_enabled: bool | None = None
    announcement_messages: list[str] | None = None
    hero_accent_word: str | None = None
    hero_headline: str | None = None
    hero_subline: str | None = None
    hero_cta_label: str | None = None
    hero_cta_href: str | None = None
    hero_image: str | None = None
    hero_image_alt: str | None = None
    quick_ctas: list[dict] | None = None
    new_in_heading: str | None = None
    new_in_sub: str | None = None
    campaign_eyebrow: str | None = None
    campaign_title_italic: str | None = None
    campaign_title: str | None = None
    campaign_copy: str | None = None
    campaign_cta_label: str | None = None
    campaign_cta_href: str | None = None
    campaign_image: str | None = None
    campaign_image_alt: str | None = None
    editorial_tiles: list[dict] | None = None
    seo_brand_story: str | None = None
    seo_categories: list[dict] | None = None
    seo_faqs: list[dict] | None = None


class HomepageContentWrite(HomepageContentRead):
    pass


async def _get_or_create(db: AsyncSession) -> HomepageContent:
    result = await db.execute(select(HomepageContent).where(HomepageContent.id == 1))
    row = result.scalar_one_or_none()
    if row is None:
        row = HomepageContent(id=1)
        db.add(row)
        await db.commit()
        await db.refresh(row)
    return row


@router.get("", response_model=HomepageContentRead)
async def get_homepage_content(db: AsyncSession = Depends(get_db_session)) -> HomepageContent:
    return await _get_or_create(db)


@router.put("", response_model=HomepageContentRead, dependencies=[Depends(require_admin)])
async def update_homepage_content(
    payload: HomepageContentWrite,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    actor: User = Depends(require_admin),
) -> HomepageContent:
    row = await _get_or_create(db)
    incoming = payload.model_dump()
    before = {field: getattr(row, field) for field in incoming}
    for field, value in incoming.items():
        setattr(row, field, value)

    # This endpoint is a full replace: a field the caller omitted is written as
    # null and the storefront falls back to the static default. That makes
    # "what did this look like before" a question only the log can answer, so
    # the whole diff is recorded rather than a summary of it.
    changed = audit.diff(before, {field: getattr(row, field) for field in incoming})
    if changed:
        await audit.record(
            db,
            actor=actor,
            request=request,
            action="homepage.update",
            entity_type="homepage",
            entity_label="Homepage",
            summary=f"Edited the homepage: {', '.join(sorted(changed))}",
            changes=changed,
        )
    await db.commit()
    await db.refresh(row)
    return row
