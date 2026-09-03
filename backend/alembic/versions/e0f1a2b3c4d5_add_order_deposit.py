"""add order deposit fields (COD confirmation deposit)

Revision ID: e0f1a2b3c4d5
Revises: 2c94bc572750
Create Date: 2026-09-03
"""
from alembic import op
import sqlalchemy as sa

revision = "e0f1a2b3c4d5"
down_revision = "2c94bc572750"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "orders",
        sa.Column("deposit_amount", sa.Numeric(10, 2), nullable=False, server_default="0"),
    )
    op.add_column(
        "orders",
        sa.Column("deposit_paid", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("orders", "deposit_paid")
    op.drop_column("orders", "deposit_amount")
