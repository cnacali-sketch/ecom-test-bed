"""Add T&C consent audit fields to orders: which policy version was agreed
to, and when. Only populated for guest/customer checkout — an admin placing
a manual/phone order on a customer's behalf has no checkbox behind them, so
these stay null there (mirrors the existing admin exception on user_id
anti-spoofing in create_order).

Revision ID: d0e1f2a3b4c5
Revises: c9d0e1f2a3b4
Create Date: 2026-07-22
"""
import sqlalchemy as sa
from alembic import op

revision = "d0e1f2a3b4c5"
down_revision = "c9d0e1f2a3b4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("terms_version", sa.String(32), nullable=True))
    op.add_column("orders", sa.Column("terms_accepted_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("orders", "terms_accepted_at")
    op.drop_column("orders", "terms_version")
