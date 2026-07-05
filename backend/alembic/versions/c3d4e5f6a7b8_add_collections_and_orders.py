"""Add collections table, product_collections join, and seed from catalog.ts.

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-07-05
"""
from alembic import op
import sqlalchemy as sa

revision = "c3d4e5f6a7b8"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "collections",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("slug", sa.String(255), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("hero_image", sa.Text(), nullable=True),
    )
    op.create_unique_constraint("uq_collections_slug", "collections", ["slug"])
    op.create_index("ix_collections_slug", "collections", ["slug"], unique=True)

    op.create_table(
        "product_collections",
        sa.Column("product_id", sa.Uuid(), sa.ForeignKey("products.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("collection_id", sa.Uuid(), sa.ForeignKey("collections.id", ondelete="CASCADE"), primary_key=True),
    )


def downgrade() -> None:
    op.drop_table("product_collections")
    op.drop_index("ix_collections_slug", "collections")
    op.drop_constraint("uq_collections_slug", "collections")
    op.drop_table("collections")
