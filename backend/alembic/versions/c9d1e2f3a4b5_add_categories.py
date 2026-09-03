"""Add categories table — admin product-tagging taxonomy, persisted so it
survives a page refresh (was browser-local-only) and edits actually stick.

Revision ID: c9d1e2f3a4b5
Revises: b4c5d6e7f8a9
Create Date: 2026-07-26
"""
import uuid

import sqlalchemy as sa
from alembic import op

revision = "c9d1e2f3a4b5"
down_revision = "b4c5d6e7f8a9"
branch_labels = None
depends_on = None

# The admin console's old local-only seed list — carried over as real data
# so the datalist isn't empty on first use of the now-persisted table.
SEED_CATEGORIES = [
    ("Scrunchies", "Hair Accessories", "scrunchies"),
    ("Claw Clips", "Hair Accessories", "claw-clips"),
    ("Earrings", "Jewellery", "earrings"),
    ("Necklaces", "Jewellery", "necklaces"),
    ("Bracelets", "Jewellery", "bracelets"),
    ("Chokers", "Bridal", "chokers"),
]


def upgrade() -> None:
    categories_table = op.create_table(
        "categories",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("slug", sa.String(120), nullable=False),
        sa.Column("parent", sa.String(100), nullable=False, server_default=""),
        sa.Column("image", sa.String(500), nullable=False, server_default=""),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_categories_slug", "categories", ["slug"], unique=True)
    op.bulk_insert(
        categories_table,
        [
            {"id": uuid.uuid4(), "name": name, "slug": slug, "parent": parent, "sort_order": i}
            for i, (name, parent, slug) in enumerate(SEED_CATEGORIES)
        ],
    )


def downgrade() -> None:
    op.drop_index("ix_categories_slug", table_name="categories")
    op.drop_table("categories")
