"""Homepage content, in the flat shape the storefront already reads.

  GET /api/sections  — the homepage fields (public: every render reads this)
  PUT /api/sections   — replace them (admin)

The contract here has not changed, but what is behind it has. These fields used
to be columns on `homepage_content`, one per editable string, where null meant
"fall back to the frontend's config file". They are now paths inside the single
`site` content document that `GET /api/content/site` serves -- see
`app/models/site_content.py` for why the content moved into the database.

This endpoint stays because the storefront in this repo renders from it and
there is no reason to break a working site to prove an architectural point. It
is a projection now, and it can be deleted once nothing asks for the flat shape.

One behaviour is worth naming because it looks like a change and is not: a null
still means "put the shipped default back". It used to achieve that by leaving
the column empty so the frontend fell through to its own copy; it now does it
by writing the packaged default into the document. Clearing a box in the editor
restores the shipped copy either way.
"""
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db_session
from app.dependencies.auth import require_admin
from app.models.site_content import SITE_KEY
from app.models.user import User
from app.routers.content import get_or_seed
from app.services import audit
from app.services.site_content import apply_homepage, project_homepage

router = APIRouter(prefix="/api/sections", tags=["sections"])


class HomepageContentRead(BaseModel):
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


@router.get("", response_model=HomepageContentRead)
async def get_homepage_content(
    db: AsyncSession = Depends(get_db_session),
) -> HomepageContentRead:
    row = await get_or_seed(db, SITE_KEY)
    return HomepageContentRead(**project_homepage(row.document))


@router.put("", response_model=HomepageContentRead, dependencies=[Depends(require_admin)])
async def update_homepage_content(
    payload: HomepageContentWrite,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    actor: User = Depends(require_admin),
) -> HomepageContentRead:
    row = await get_or_seed(db, SITE_KEY)
    incoming = payload.model_dump()

    before = project_homepage(row.document)
    row.document = apply_homepage(row.document, incoming)
    after = project_homepage(row.document)

    changed = audit.diff(before, after)
    if changed:
        # The version moves only when something actually moved, so an editor
        # holding the page open is not told it went stale by a save that
        # changed nothing.
        row.version += 1
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
    return HomepageContentRead(**project_homepage(row.document))
