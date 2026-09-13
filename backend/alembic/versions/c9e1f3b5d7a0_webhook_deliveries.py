"""Record every webhook Razorpay sends, including the ones that fail.

The payment webhook is the only part of this system that moves money with
nobody watching, and it kept no record of doing so. An ignored delivery
returned 200 and vanished; a forged one was refused and vanished; one that
raised took the request down and vanished.

That last case is not hypothetical. `payment_status` was varchar(16) while the
refund handler wrote "partially_refunded", so every refund webhook would have
500'd. Razorpay retries and then gives up, and the shop would have been left
with a refund at Razorpay and nothing here to say it had ever been attempted.

New table only -- nothing existing is read, altered or dropped, so the
rollback is a plain drop and every other table behaves identically either way.

`order_id` is deliberately a plain column and not a foreign key. Three tables
already reference `orders.id`, and until this week two of them made an order
undeletable; a log of what arrived should not be able to block the deletion of
what it arrived about.

Revision ID: c9e1f3b5d7a0
Revises: b8d0f2a4c6e9
Create Date: 2026-09-13
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "c9e1f3b5d7a0"
down_revision = "b8d0f2a4c6e9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "webhook_deliveries",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("event", sa.String(length=64), nullable=True),
        sa.Column("event_id", sa.String(length=64), nullable=True),
        sa.Column("signature_valid", sa.Boolean(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("detail", sa.String(length=2000), nullable=True),
        sa.Column("order_id", sa.Uuid(), nullable=True),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "received_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("attempts", sa.Integer(), server_default="1", nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_webhook_deliveries_event", "webhook_deliveries", ["event"])
    op.create_index("ix_webhook_deliveries_event_id", "webhook_deliveries", ["event_id"])
    op.create_index("ix_webhook_deliveries_status", "webhook_deliveries", ["status"])
    op.create_index("ix_webhook_deliveries_order_id", "webhook_deliveries", ["order_id"])
    op.create_index(
        "ix_webhook_deliveries_received_at", "webhook_deliveries", ["received_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_webhook_deliveries_received_at", "webhook_deliveries")
    op.drop_index("ix_webhook_deliveries_order_id", "webhook_deliveries")
    op.drop_index("ix_webhook_deliveries_status", "webhook_deliveries")
    op.drop_index("ix_webhook_deliveries_event_id", "webhook_deliveries")
    op.drop_index("ix_webhook_deliveries_event", "webhook_deliveries")
    op.drop_table("webhook_deliveries")
