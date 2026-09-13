"""Give an inventory snapshot the day it belongs to, and one reading per day.

`inventory_snapshots` has existed since the first migration and has never held
a row -- confirmed against production, where the count is zero. So this is a
schema change to an empty table: the new column can be NOT NULL immediately,
with no backfill to get wrong and no existing reading to reinterpret.

The unique constraint is the point of the change. The capture job is easy to
run by hand as well as on its timer, and the API runs as a single uvicorn
process today only because nobody has passed `--workers 2` yet. Either would
otherwise write two readings for the same product on the same day, and a stock
history that disagrees with itself is worse than an empty one -- a later trend
line would average the pair and produce a number that looks considered.

Revision ID: b8d0f2a4c6e9
Revises: a7c9e1f3b5d8
Create Date: 2026-09-13
"""
import sqlalchemy as sa
from alembic import op

revision = "b8d0f2a4c6e9"
down_revision = "a7c9e1f3b5d8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "inventory_snapshots", sa.Column("snapshot_date", sa.Date(), nullable=False)
    )
    op.create_index(
        "ix_inventory_snapshots_snapshot_date",
        "inventory_snapshots",
        ["snapshot_date"],
    )
    op.create_unique_constraint(
        "uq_inventory_snapshots_product_day",
        "inventory_snapshots",
        ["product_id", "snapshot_date"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_inventory_snapshots_product_day", "inventory_snapshots", type_="unique"
    )
    op.drop_index("ix_inventory_snapshots_snapshot_date", "inventory_snapshots")
    op.drop_column("inventory_snapshots", "snapshot_date")
