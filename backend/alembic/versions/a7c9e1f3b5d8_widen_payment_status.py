"""Make `orders.payment_status` wide enough for the value the code already writes.

The column is varchar(16). "partially_refunded" is eighteen characters. Every
path that writes it is live:

* `POST /api/orders/{id}/refund` sets it whenever a refund is smaller than the
  order total -- `routers/orders.py` picks between "refunded" and
  "partially_refunded" on exactly that comparison.
* The Razorpay `refund.processed` webhook does the same, unattended.
* The console's payment dropdown offers it, because Phase 8's
  `PAYMENT_TRANSITIONS` lists it as a reachable state.

None of them could ever have worked. PostgreSQL rejects the write with
`StringDataRightTruncationError`, so the request 500s. On the webhook that is
the expensive one: Razorpay keeps retrying, the refund exists at Razorpay, and
this database never records it.

It went unnoticed because the test suite runs on SQLite, which ignores varchar
lengths entirely -- it stores the eighteen characters and every assertion
passes. Running the suite against real PostgreSQL is what surfaced it, in seven
tests across four files at once.

Widened to 32 to match `orders.status`, which already holds "partially_..."-
length words. Widening a varchar is a catalogue-only change in PostgreSQL: no
table rewrite, no lock beyond the instant, and every existing value stays
byte-identical. The eleven live orders are all "paid" or "unpaid".

The downgrade narrows it back, which can only fail if a value longer than 16
has been written in the meantime -- that is the correct behaviour, since
truncating a payment status silently would be worse than refusing.

Revision ID: a7c9e1f3b5d8
Revises: f6b8d0e2a4c7
Create Date: 2026-09-13
"""
import sqlalchemy as sa
from alembic import op

revision = "a7c9e1f3b5d8"
down_revision = "f6b8d0e2a4c7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "orders",
        "payment_status",
        existing_type=sa.String(length=16),
        type_=sa.String(length=32),
        existing_nullable=False,
        existing_server_default="unpaid",
    )


def downgrade() -> None:
    op.alter_column(
        "orders",
        "payment_status",
        existing_type=sa.String(length=32),
        type_=sa.String(length=16),
        existing_nullable=False,
        existing_server_default="unpaid",
    )
