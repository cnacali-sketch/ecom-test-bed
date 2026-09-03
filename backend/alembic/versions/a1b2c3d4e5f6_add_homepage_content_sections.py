"""add homepage content sections (quick ctas, campaign, editorial tiles, seo)

Revision ID: a1b2c3d4e5f6
Revises: f5a6b7c8d9e0
Create Date: 2026-07-27 00:00:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "a1b2c3d4e5f6"
down_revision = "f5a6b7c8d9e0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("homepage_content", sa.Column("quick_ctas", sa.JSON(), nullable=True))
    op.add_column("homepage_content", sa.Column("new_in_heading", sa.String(100), nullable=True))
    op.add_column("homepage_content", sa.Column("new_in_sub", sa.String(300), nullable=True))
    op.add_column("homepage_content", sa.Column("campaign_eyebrow", sa.String(100), nullable=True))
    op.add_column("homepage_content", sa.Column("campaign_title_italic", sa.String(100), nullable=True))
    op.add_column("homepage_content", sa.Column("campaign_title", sa.String(200), nullable=True))
    op.add_column("homepage_content", sa.Column("campaign_copy", sa.String(500), nullable=True))
    op.add_column("homepage_content", sa.Column("campaign_cta_label", sa.String(100), nullable=True))
    op.add_column("homepage_content", sa.Column("campaign_cta_href", sa.String(300), nullable=True))
    op.add_column("homepage_content", sa.Column("campaign_image", sa.String(1000), nullable=True))
    op.add_column("homepage_content", sa.Column("campaign_image_alt", sa.String(300), nullable=True))
    op.add_column("homepage_content", sa.Column("editorial_tiles", sa.JSON(), nullable=True))
    op.add_column("homepage_content", sa.Column("seo_brand_story", sa.String(2000), nullable=True))
    op.add_column("homepage_content", sa.Column("seo_categories", sa.JSON(), nullable=True))
    op.add_column("homepage_content", sa.Column("seo_faqs", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("homepage_content", "seo_faqs")
    op.drop_column("homepage_content", "seo_categories")
    op.drop_column("homepage_content", "seo_brand_story")
    op.drop_column("homepage_content", "editorial_tiles")
    op.drop_column("homepage_content", "campaign_image_alt")
    op.drop_column("homepage_content", "campaign_image")
    op.drop_column("homepage_content", "campaign_cta_href")
    op.drop_column("homepage_content", "campaign_cta_label")
    op.drop_column("homepage_content", "campaign_copy")
    op.drop_column("homepage_content", "campaign_title")
    op.drop_column("homepage_content", "campaign_title_italic")
    op.drop_column("homepage_content", "campaign_eyebrow")
    op.drop_column("homepage_content", "new_in_sub")
    op.drop_column("homepage_content", "new_in_heading")
    op.drop_column("homepage_content", "quick_ctas")
