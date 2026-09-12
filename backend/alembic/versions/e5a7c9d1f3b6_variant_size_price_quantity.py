"""Give variants a size, their own price, and a countable quantity.

A variant has carried a colour, a hex swatch, an image and a yes/no in-stock
flag. That was enough while nothing could edit them -- and nothing could: the
admin console has never had a variant UI, `lib/admin/adapt.ts` sends
`variants: []` on every save, and `PUT /api/products/{id}` excludes the field
entirely. The fifty variants in production survive because of that exclusion,
not because anything protects them.

This adds the columns the console will need. Every one is nullable, and null
means "ask the product":

* `size` -- absent on all fifty existing rows, which are colour variants.
* `price` / `mrp` -- null means the parent's pricing, which is what those rows
  already do. They are added together deliberately: a variant with its own
  price and the parent's MRP renders a discount computed from two unrelated
  numbers, advertising a saving the shop never offered.
* `stock_quantity` -- null means nobody is counting this variant. Defaulting to
  zero would have read as "sold out" and taken thirty products off sale the
  moment this migration ran.

Additive only. No existing value is read, rewritten or dropped, so the rollback
is a plain column drop and the fifty rows behave identically before and after.

Revision ID: e5a7c9d1f3b6
Revises: d4f6b8c0e2a4
Create Date: 2026-09-13
"""
import sqlalchemy as sa
from alembic import op

revision = "e5a7c9d1f3b6"
down_revision = "d4f6b8c0e2a4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("product_variants", sa.Column("size", sa.String(length=32), nullable=True))
    op.add_column("product_variants", sa.Column("price", sa.Numeric(10, 2), nullable=True))
    op.add_column("product_variants", sa.Column("mrp", sa.Numeric(10, 2), nullable=True))
    op.add_column("product_variants", sa.Column("stock_quantity", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("product_variants", "stock_quantity")
    op.drop_column("product_variants", "mrp")
    op.drop_column("product_variants", "price")
    op.drop_column("product_variants", "size")
