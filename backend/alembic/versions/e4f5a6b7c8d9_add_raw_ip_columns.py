"""Add raw ip_address alongside the existing hashed ip_hash on user_events,
and ip_address on orders — a hash alone isn't actionable for an admin
reviewing a flagged fraud pattern (can't block a hash at the firewall).

Revision ID: e4f5a6b7c8d9
Revises: d2e3f4a5b6c7
Create Date: 2026-07-26
"""
import sqlalchemy as sa
from alembic import op

revision = "e4f5a6b7c8d9"
down_revision = "d2e3f4a5b6c7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("user_events", sa.Column("ip_address", sa.String(64), nullable=True))
    op.add_column("orders", sa.Column("ip_address", sa.String(64), nullable=True))


def downgrade() -> None:
    op.drop_column("orders", "ip_address")
    op.drop_column("user_events", "ip_address")
