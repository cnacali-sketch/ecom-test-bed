"""Add homepage_content singleton table — live overrides for the hero
banner and announcement ribbon, so the admin Homepage editor actually
affects the storefront instead of resetting to hardcoded seed data.

Revision ID: d2e3f4a5b6c7
Revises: c9d1e2f3a4b5
Create Date: 2026-07-26
"""
import sqlalchemy as sa
from alembic import op

revision = "d2e3f4a5b6c7"
down_revision = "c9d1e2f3a4b5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "homepage_content",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("announcement_enabled", sa.Boolean(), nullable=True),
        sa.Column("announcement_messages", sa.JSON(), nullable=True),
        sa.Column("hero_accent_word", sa.String(100), nullable=True),
        sa.Column("hero_headline", sa.String(200), nullable=True),
        sa.Column("hero_subline", sa.String(500), nullable=True),
        sa.Column("hero_cta_label", sa.String(100), nullable=True),
        sa.Column("hero_cta_href", sa.String(300), nullable=True),
        sa.Column("hero_image", sa.String(1000), nullable=True),
        sa.Column("hero_image_alt", sa.String(300), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("homepage_content")
