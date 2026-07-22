"""Add coupons table and the order-side snapshot columns (coupon_code,
discount_amount). The code is snapshotted onto the order (not just a FK) so a
later coupon edit/deactivation can never rewrite what a past order actually
paid — same idiom as the shipping_address snapshot.

Revision ID: e1f2a3b4c5d6
Revises: d0e1f2a3b4c5
Create Date: 2026-07-22
"""
import sqlalchemy as sa
from alembic import op

revision = "e1f2a3b4c5d6"
down_revision = "d0e1f2a3b4c5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "coupons",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("code", sa.String(32), nullable=False),
        sa.Column("discount_type", sa.String(16), nullable=False),
        sa.Column("value", sa.Numeric(10, 2), nullable=False),
        sa.Column("min_order_value", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("usage_limit", sa.Integer(), nullable=True),
        sa.Column("times_used", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_coupons_code", "coupons", ["code"], unique=True)

    op.add_column("orders", sa.Column("coupon_code", sa.String(32), nullable=True))
    op.add_column(
        "orders", sa.Column("discount_amount", sa.Numeric(10, 2), nullable=False, server_default="0")
    )


def downgrade() -> None:
    op.drop_column("orders", "discount_amount")
    op.drop_column("orders", "coupon_code")
    op.drop_index("ix_coupons_code", table_name="coupons")
    op.drop_table("coupons")
