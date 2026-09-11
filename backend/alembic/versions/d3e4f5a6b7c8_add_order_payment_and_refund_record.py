"""Record the captured payment and any refund against the order.

Three gaps this closes, all raised by the operations audit:

* The Razorpay *payment* id was verified at checkout and then thrown away.
  Only razorpay_order_id was stored, which is issued before payment and does
  not appear on a settlement report — so a bank settlement could not be tied
  back to the orders that produced it. It is also the id Razorpay's refund API
  takes, so refunds could not be issued from our own records either.

* A refund was one word on payment_status, with no amount, date or reference.
* Partial refunds had nowhere to live at all, so refunding part of an order
  forced a choice between overstating and understating revenue.

refund_amount is NOT NULL with a 0 default so arithmetic against total_amount
never has to guard for null. No backfill for razorpay_payment_id: the value
was genuinely never recorded for past orders, and inventing one would be worse
than an honest blank.

Revision ID: d3e4f5a6b7c8
Revises: c2d3e4f5a6b7
Create Date: 2026-09-11
"""
import sqlalchemy as sa
from alembic import op

revision = "d3e4f5a6b7c8"
down_revision = "c2d3e4f5a6b7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("razorpay_payment_id", sa.String(64), nullable=True))
    op.add_column(
        "orders",
        sa.Column(
            "refund_amount",
            sa.Numeric(10, 2),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column("orders", sa.Column("refunded_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("orders", sa.Column("refund_reference", sa.String(128), nullable=True))

    # An order already marked refunded was, under the old all-or-nothing model,
    # necessarily a full refund — that was the only kind the system could
    # express. Recording the amount makes the books agree with the status.
    # refunded_at stays null: the date was never captured and guessing it would
    # put a fabricated figure in an accounting record.
    op.execute("UPDATE orders SET refund_amount = total_amount WHERE payment_status = 'refunded'")


def downgrade() -> None:
    op.drop_column("orders", "refund_reference")
    op.drop_column("orders", "refunded_at")
    op.drop_column("orders", "refund_amount")
    op.drop_column("orders", "razorpay_payment_id")
