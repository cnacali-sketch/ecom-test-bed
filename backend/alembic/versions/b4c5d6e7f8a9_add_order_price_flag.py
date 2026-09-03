"""Add flagged + flag_reason to orders, for server-side price-tampering
detection (create_order now compares client unit_price against the real
Product.price and flags a mismatch for admin review, regardless of
payment_method — COD orders included).

Revision ID: b4c5d6e7f8a9
Revises: a3b4c5d6e7f8
Create Date: 2026-07-22
"""
import sqlalchemy as sa
from alembic import op

revision = "b4c5d6e7f8a9"
down_revision = "a3b4c5d6e7f8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "orders",
        sa.Column("flagged", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column("orders", sa.Column("flag_reason", sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column("orders", "flag_reason")
    op.drop_column("orders", "flagged")
