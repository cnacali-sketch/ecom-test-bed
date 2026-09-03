"""Homepage content overrides — a singleton row (id is always 1).

Every field is nullable and means "use content/site.config.ts's static
default" when null. A non-null value is a live admin override, read by the
storefront's HeroBanner and the header's announcement ribbon alongside their
static defaults — the same opt-in-live-override-with-fallback pattern the
product catalogue already uses (bundled catalog vs. live backend).
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class HomepageContent(Base):
    __tablename__ = "homepage_content"

    id: Mapped[int] = mapped_column(primary_key=True, default=1)

    announcement_enabled: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    announcement_messages: Mapped[list | None] = mapped_column(JSON, nullable=True)

    hero_accent_word: Mapped[str | None] = mapped_column(String(100), nullable=True)
    hero_headline: Mapped[str | None] = mapped_column(String(200), nullable=True)
    hero_subline: Mapped[str | None] = mapped_column(String(500), nullable=True)
    hero_cta_label: Mapped[str | None] = mapped_column(String(100), nullable=True)
    hero_cta_href: Mapped[str | None] = mapped_column(String(300), nullable=True)
    hero_image: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    hero_image_alt: Mapped[str | None] = mapped_column(String(300), nullable=True)

    # Quick CTA tiles below the hero. Whole-list override (like
    # announcement_messages above) rather than per-tile columns, since the
    # admin always edits the set as a unit.
    quick_ctas: Mapped[list | None] = mapped_column(JSON, nullable=True)

    new_in_heading: Mapped[str | None] = mapped_column(String(100), nullable=True)
    new_in_sub: Mapped[str | None] = mapped_column(String(300), nullable=True)

    campaign_eyebrow: Mapped[str | None] = mapped_column(String(100), nullable=True)
    campaign_title_italic: Mapped[str | None] = mapped_column(String(100), nullable=True)
    campaign_title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    campaign_copy: Mapped[str | None] = mapped_column(String(500), nullable=True)
    campaign_cta_label: Mapped[str | None] = mapped_column(String(100), nullable=True)
    campaign_cta_href: Mapped[str | None] = mapped_column(String(300), nullable=True)
    campaign_image: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    campaign_image_alt: Mapped[str | None] = mapped_column(String(300), nullable=True)

    editorial_tiles: Mapped[list | None] = mapped_column(JSON, nullable=True)

    seo_brand_story: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    seo_categories: Mapped[list | None] = mapped_column(JSON, nullable=True)
    seo_faqs: Mapped[list | None] = mapped_column(JSON, nullable=True)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
