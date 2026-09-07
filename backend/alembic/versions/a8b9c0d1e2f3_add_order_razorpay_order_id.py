"""Add razorpay_order_id to orders.

Binds /razorpay/verify to the exact Razorpay order created at /razorpay/init,
closing a payment-verification bypass: without this column, a signature
valid for one order's payment could be replayed against any other order's
/verify endpoint to mark it paid for free (the signature only proves a
payment happened, never which internal order it was for).

Revision ID: a8b9c0d1e2f3
Revises: e0f1a2b3c4d5
Create Date: 2026-09-07
"""
import sqlalchemy as sa
from alembic import op

revision = "a8b9c0d1e2f3"
down_revision = "e0f1a2b3c4d5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("razorpay_order_id", sa.String(64), nullable=True))


def downgrade() -> None:
    op.drop_column("orders", "razorpay_order_id")
