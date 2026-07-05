"""Add slug + in_stock to products; clean variant table.

Revision ID: b2c3d4e5f6a7
Revises: af467e5186ed
Create Date: 2026-07-05
"""
from alembic import op
import sqlalchemy as sa

revision = "b2c3d4e5f6a7"
down_revision = "af467e5186ed"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Products: add slug (backfill from attrs), add in_stock
    op.add_column("products", sa.Column("slug", sa.String(255), nullable=True))
    op.add_column("products", sa.Column("in_stock", sa.Boolean(), nullable=False, server_default="true"))

    # Backfill slug from attrs JSON (Postgres only; SQLite tests use fresh DB)
    op.execute("UPDATE products SET slug = attrs->>'slug' WHERE slug IS NULL")
    op.execute("UPDATE products SET slug = sku WHERE slug IS NULL OR slug = ''")

    op.alter_column("products", "slug", nullable=False)
    op.create_unique_constraint("uq_products_slug", "products", ["slug"])
    op.create_index("ix_products_slug", "products", ["slug"], unique=True)

    # Variants: add explicit colour columns, remove duplicated product columns
    op.add_column("product_variants", sa.Column("color", sa.String(64), nullable=True))
    op.add_column("product_variants", sa.Column("color_hex", sa.String(16), nullable=True))
    op.add_column("product_variants", sa.Column("image", sa.Text(), nullable=True))
    op.add_column("product_variants", sa.Column("in_stock", sa.Boolean(), nullable=False, server_default="true"))

    # Backfill from attrs JSON
    op.execute("UPDATE product_variants SET color = attrs->>'color' WHERE color IS NULL")
    op.execute("UPDATE product_variants SET color_hex = attrs->>'colorHex' WHERE color_hex IS NULL")
    op.execute("UPDATE product_variants SET in_stock = (attrs->>'inStock')::boolean WHERE in_stock IS TRUE")

    op.alter_column("product_variants", "color", nullable=False)
    op.alter_column("product_variants", "color_hex", nullable=False)

    # Drop columns that duplicated the parent product (per-variant pricing is YAGNI)
    op.drop_column("product_variants", "price")
    op.drop_column("product_variants", "mrp")
    op.drop_column("product_variants", "description")
    op.drop_column("product_variants", "images")
    op.drop_column("product_variants", "name")


def downgrade() -> None:
    # Re-add removed variant columns
    op.add_column("product_variants", sa.Column("name", sa.String(255), nullable=False, server_default=""))
    op.add_column("product_variants", sa.Column("price", sa.Numeric(10, 2), nullable=False, server_default="0"))
    op.add_column("product_variants", sa.Column("mrp", sa.Numeric(10, 2), nullable=False, server_default="0"))
    op.add_column("product_variants", sa.Column("description", sa.Text(), nullable=True))
    op.add_column("product_variants", sa.Column("images", sa.JSON(), nullable=False, server_default="[]"))

    op.drop_column("product_variants", "color")
    op.drop_column("product_variants", "color_hex")
    op.drop_column("product_variants", "image")
    op.drop_column("product_variants", "in_stock")

    op.drop_index("ix_products_slug", "products")
    op.drop_constraint("uq_products_slug", "products")
    op.drop_column("products", "slug")
    op.drop_column("products", "in_stock")
