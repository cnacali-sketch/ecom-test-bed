"""Add user_agent to orders.

The admin Orders screen shows which device an order came from (Windows /
Android / iOS, and the browser). The raw User-Agent is the only place that
information exists, and nothing was recording it against the order — the
fraud tables keep their own copy for page views, but those cannot be tied
back to a specific order with any confidence.

Nullable with no backfill: every order placed before this column existed
genuinely has no User-Agent, and inventing one would be worse than showing
"Unknown device". Admin-entered phone orders stay null for the same reason.

Revision ID: b1c2d3e4f5a6
Revises: a8b9c0d1e2f3
Create Date: 2026-09-11
"""
import sqlalchemy as sa
from alembic import op

revision = "b1c2d3e4f5a6"
down_revision = "a8b9c0d1e2f3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 256 chars matches user_events.user_agent; real UA strings run to roughly
    # 150, and the write truncates rather than erroring.
    op.add_column("orders", sa.Column("user_agent", sa.String(256), nullable=True))


def downgrade() -> None:
    op.drop_column("orders", "user_agent")
