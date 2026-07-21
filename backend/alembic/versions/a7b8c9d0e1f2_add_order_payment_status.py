"""Add orders.payment_status (payment lifecycle: unpaid/paid/refunded).

Tracked separately from the fulfilment `status` column so an admin can mark a
paid order returned, or a delivered order refunded, without conflating the two.

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-07-21
"""
import sqlalchemy as sa
from alembic import op

revision = "a7b8c9d0e1f2"
down_revision = "f6a7b8c9d0e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "orders",
        sa.Column("payment_status", sa.String(16), nullable=False, server_default="unpaid"),
    )


def downgrade() -> None:
    op.drop_column("orders", "payment_status")
