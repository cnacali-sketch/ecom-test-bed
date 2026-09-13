"""add waitlist_signups

The shop is starting in Bengaluru only. Someone outside that area who tries to
check out is offered a place on a waitlist instead of a dead end, and this is
where those go.

Purely additive: a new table, no change to any existing one, so downgrade is a
clean drop and nothing else in the schema notices either direction.

Revision ID: d0f2a4c6e8b1
Revises: c9e1f3b5d7a0
"""
import sqlalchemy as sa
from alembic import op

revision = "d0f2a4c6e8b1"
down_revision = "c9e1f3b5d7a0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "waitlist_signups",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("phone", sa.String(length=32), nullable=False),
        sa.Column("postcode", sa.String(length=16), nullable=False),
        sa.Column("district", sa.String(length=120), server_default="", nullable=False),
        sa.Column("state", sa.String(length=120), server_default="", nullable=False),
        sa.Column("status", sa.String(length=32), server_default="pending", nullable=False),
        sa.Column("note", sa.String(length=500), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
    )
    # Checkout asks "is this postcode approved?" on every out-of-area order, and
    # the admin counts demand by area. Both read through this column.
    op.create_index("ix_waitlist_signups_postcode", "waitlist_signups", ["postcode"])


def downgrade() -> None:
    op.drop_index("ix_waitlist_signups_postcode", table_name="waitlist_signups")
    op.drop_table("waitlist_signups")
