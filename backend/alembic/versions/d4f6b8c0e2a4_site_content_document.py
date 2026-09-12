"""Content the backend owns, in a shape a second storefront can read.

Most of this shop's words and pictures have never been in the database. They
live in `frontend/content/site.config.ts`, and `homepage_content` holds only a
thin layer of admin overrides on top -- one nullable column per editable field,
where null means "use whatever the frontend says".

That works exactly as long as there is one frontend. A second storefront would
have to copy the config file to render anything, and from that moment the shop
would edit a headline in the admin and watch one of its two sites ignore it.

This migration moves the content itself into the database. `site_content` holds
one JSON document under the key `site`, seeded from a generated export of the
config file and then overlaid with whatever the admin had already overridden.
After this the database is the source of truth and the config file is only an
offline fallback.

**The old table is left in place, still populated.** Nothing reads it after
this, but a rollback that had thrown the row away would have nowhere to get
the shop's real headline back from. Removing it is a later, separate decision
once this has proven itself in production.

The overlay skips nulls deliberately. In the old table null meant "fall back to
the default", but here the document already *is* the defaults -- writing the
null through would erase the content rather than reveal something under it.

Revision ID: d4f6b8c0e2a4
Revises: c3e5a7b9d1f4
Create Date: 2026-09-12
"""
import json
from pathlib import Path

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "d4f6b8c0e2a4"
down_revision = "c3e5a7b9d1f4"
branch_labels = None
depends_on = None

JSONType = postgresql.JSONB().with_variant(sa.JSON(), "sqlite")

SITE_KEY = "site"

# Imported rather than restated: the mapping between the old flat columns and
# the document's paths is needed by the API too, and two copies of it would
# drift into dropping a field silently.
from app.services.site_content import HOMEPAGE_PATHS, defaults, set_path  # noqa: E402


def upgrade() -> None:
    # The returned Table is kept and used for the seed insert below. Binding
    # through a typed column is what lets the driver serialise the document
    # itself; handing a JSON string to a jsonb parameter through raw text()
    # relies on an implicit cast that asyncpg does not perform.
    site_content = op.create_table(
        "site_content",
        sa.Column("key", sa.String(length=64), primary_key=True),
        sa.Column("document", JSONType, nullable=False, server_default="{}"),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    bind = op.get_bind()
    document = defaults()

    # Overlay whatever the admin had already saved. The old table may not exist
    # in a database built from scratch by these migrations in one go, and it is
    # legitimately empty on an install where nobody ever opened the editor.
    inspector = sa.inspect(bind)
    if "homepage_content" in inspector.get_table_names():
        columns = ", ".join(HOMEPAGE_PATHS)
        row = bind.execute(
            sa.text(f"SELECT {columns} FROM homepage_content WHERE id = 1")
        ).mappings().first()
        if row is not None:
            for field, path in HOMEPAGE_PATHS.items():
                value = row[field]
                if value is None:
                    continue
                # SQLite hands JSON columns back as text; Postgres decodes them.
                if isinstance(value, str) and path[-1] in {
                    "messages",
                    "quickCtas",
                    "editorialTiles",
                    "categories",
                    "faqs",
                }:
                    try:
                        value = json.loads(value)
                    except ValueError:
                        continue
                set_path(document, path, value)

    # Inserted through the typed table rather than raw SQL, so the dialect
    # serialises the document into jsonb (or JSON text on SQLite) itself.
    bind.execute(site_content.insert().values(key=SITE_KEY, document=document, version=1))


def downgrade() -> None:
    # `homepage_content` was never emptied, so dropping this table returns the
    # shop to exactly the content it had before -- config file plus overrides.
    op.drop_table("site_content")
