"""Track whether an order's stock has been given back.

Placing an order reserves stock; cancelling it used to change a word and
nothing else, so every cancellation permanently removed sellable units the
shop still physically owned. Approving a return, meanwhile, already restocked
AND set the order to "returned" — so simply restocking on that status would
have counted those units twice.

A flag on the order makes the operation idempotent and lets cancel, return and
delete compose in any order.

Backfill is deliberate and conservative. Orders that already ended as
cancelled or returned are marked released: their units were either never
returned (cancelled — nothing to undo now, and marking them unreleased would
let a later delete hand out stock that was never taken back) or already
returned by the returns flow (returned — marking them unreleased would allow a
second restock). Every other order is still holding its units, which is the
default.

Revision ID: c2d3e4f5a6b7
Revises: b1c2d3e4f5a6
Create Date: 2026-09-11
"""
import sqlalchemy as sa
from alembic import op

revision = "c2d3e4f5a6b7"
down_revision = "b1c2d3e4f5a6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "orders",
        sa.Column("stock_released", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.execute(
        "UPDATE orders SET stock_released = true "
        "WHERE status IN ('cancelled', 'returned')"
    )


def downgrade() -> None:
    op.drop_column("orders", "stock_released")
