"""Drop leftover NOT NULL attrs column on product_variants.

b2c3d4e5f6a7 moved variant color/size fields to explicit columns and
dropped price/mrp/description/images/name, but missed the original
NOT NULL `attrs` JSONB column from the initial schema. ProductVariant
no longer has an `attrs` field, so any insert through the ORM fails
with a not-null violation.

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-07-17
"""
from alembic import op

revision = "d4e5f6a7b8c9"
down_revision = "c3d4e5f6a7b8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("product_variants", "attrs")


def downgrade() -> None:
    import sqlalchemy as sa
    from sqlalchemy.dialects import postgresql

    op.add_column(
        "product_variants",
        sa.Column("attrs", postgresql.JSONB(), nullable=False, server_default="{}"),
    )
