"""Add ip_hash + user_agent to user_events, for first-party fraud/abuse
detection (ad-click velocity, checkout/coupon abuse). ip_hash is an HMAC of
the client IP, never the raw address — enough to group repeat visits without
storing PII.

Revision ID: a3b4c5d6e7f8
Revises: f2a3b4c5d6e7
Create Date: 2026-07-22
"""
import sqlalchemy as sa
from alembic import op

revision = "a3b4c5d6e7f8"
down_revision = "f2a3b4c5d6e7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("user_events", sa.Column("ip_hash", sa.String(32), nullable=True))
    op.add_column("user_events", sa.Column("user_agent", sa.String(256), nullable=True))
    op.create_index("ix_user_events_ip_hash", "user_events", ["ip_hash"])


def downgrade() -> None:
    op.drop_index("ix_user_events_ip_hash", table_name="user_events")
    op.drop_column("user_events", "user_agent")
    op.drop_column("user_events", "ip_hash")
