"""Add order fulfilment fields: shipping address snapshot, payment method,
courier, tracking number.

The shipping address is snapshotted onto the order at checkout time (JSONB
copy, not a link to the customer's profile) so a later profile edit can never
rewrite where an already-placed order was shipped.

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
Create Date: 2026-07-22
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "c9d0e1f2a3b4"
down_revision = "b8c9d0e1f2a3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("shipping_address", JSONB(), nullable=False, server_default="{}"))
    op.add_column(
        "orders",
        sa.Column("payment_method", sa.String(16), nullable=False, server_default="cod"),
    )
    op.add_column("orders", sa.Column("courier", sa.String(64), nullable=True))
    op.add_column("orders", sa.Column("tracking_number", sa.String(128), nullable=True))


def downgrade() -> None:
    op.drop_column("orders", "tracking_number")
    op.drop_column("orders", "courier")
    op.drop_column("orders", "payment_method")
    op.drop_column("orders", "shipping_address")
