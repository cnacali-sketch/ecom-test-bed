"""The site's content, as a document the API can hand to any storefront.

Until now the shop's words and pictures lived in two places that neither of
them owned outright. The bulk of it -- brand, navigation, footer, policies,
every default on the homepage -- sat in a 584-line TypeScript file *inside the
frontend*, and a much smaller set of admin overrides sat in `homepage_content`
as one row with a fixed column per field.

That arrangement has two costs, and the second is the one that matters here:

**Adding a field means a migration.** A column per editable string does not
scale past the homepage, and nothing about it could describe a second page.

**A second storefront cannot exist.** This is the real limit. A new frontend
would have to copy `site.config.ts` to render anything, and from the moment it
did, the two copies would drift -- the shop would edit a headline in the admin
and watch one of its two storefronts ignore it. Content the backend cannot
serve is content the backend does not own.

So the document is the whole thing, not the overrides. A storefront asks for
`site` and receives everything it needs to render: brand, nav, footer,
policies, homepage copy, SEO defaults. The frontend's config file survives only
as an offline fallback for when the API is unreachable.

**Keyed, not singleton.** `homepage_content` hardcoded `id = 1` because there
was exactly one thing to store. A key column costs nothing today and is what
lets a second document -- another page, a second brand -- exist later without
another migration, which is the mistake this table is replacing.

**Versioned.** Every write bumps `version`. It gives the admin screen a way to
detect that somebody else saved while a form was open, rather than silently
overwriting their work with a stale copy of the page.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from sqlalchemy.types import JSON

from app.db import Base

JSONType = JSONB().with_variant(JSON(), "sqlite")

#: The one document that exists today: everything the storefront renders.
SITE_KEY = "site"


class SiteContent(Base):
    __tablename__ = "site_content"

    # The key is the identity. There is no surrogate id because there is
    # nothing to point at a content document *by* except its name.
    key: Mapped[str] = mapped_column(String(64), primary_key=True)

    document: Mapped[dict] = mapped_column(JSONType, default=dict, server_default="{}")

    # Bumped on every write, never reused. Not a timestamp: two saves inside
    # the same second are exactly the case a concurrency check has to catch,
    # and on SQLite `now()` cannot tell them apart.
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
