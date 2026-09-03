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
from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db_session
from app.dependencies.auth import require_admin
from app.models.homepage_content import HomepageContent

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
    payload: HomepageContentWrite, db: AsyncSession = Depends(get_db_session)
) -> HomepageContent:
    row = await _get_or_create(db)
    for field, value in payload.model_dump().items():
        setattr(row, field, value)
    await db.commit()
    await db.refresh(row)
    return row
