"""Add return_requests table — a customer-initiated return request against a
delivered order, distinct from the pre-existing "returned" fulfilment status
that an admin could only set by hand with no request behind it.

Revision ID: f2a3b4c5d6e7
Revises: e1f2a3b4c5d6
Create Date: 2026-07-22
"""
import sqlalchemy as sa
from alembic import op

revision = "f2a3b4c5d6e7"
down_revision = "e1f2a3b4c5d6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "return_requests",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("order_id", sa.Uuid(), sa.ForeignKey("orders.id"), nullable=False),
        sa.Column("reason", sa.String(500), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("pickup_requested", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_return_requests_order_id", "return_requests", ["order_id"])


def downgrade() -> None:
    op.drop_index("ix_return_requests_order_id", table_name="return_requests")
    op.drop_table("return_requests")
