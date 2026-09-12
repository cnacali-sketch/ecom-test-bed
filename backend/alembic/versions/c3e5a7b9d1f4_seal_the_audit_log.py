"""Make the audit log tamper-evident.

The table has recorded admin actions since `b2d4f6a8c0e2`, but only
append-only *by convention*: nothing stopped an UPDATE, and nothing would have
shown that one had happened. A log that can be quietly rewritten answers no
question worth asking, which is the whole reason the table exists.

Two mechanisms, deliberately different in kind:

**A trigger** refuses UPDATE and DELETE on every row. This stops the ordinary
case — a stray query, a future code path, an admin with database access
tidying something away.

**A hash chain** catches the case the trigger cannot. Somebody able to create
the trigger is also able to drop it, change a row, and put it back. Each entry
stores the hash of the entry before it, so any edit anywhere in the table
breaks every hash after it, and `GET /api/audit/verify` reports where.

The chain starts clean: `audit_logs` held zero rows in production when this
was written, so there is no history to backfill and no genesis to fabricate.

Pruning the table now requires dropping the trigger first. That friction is
the point — retention becomes a deliberate act with a paper trail of its own
rather than a DELETE somebody runs without thinking.

Revision ID: c3e5a7b9d1f4
Revises: b2d4f6a8c0e2
Create Date: 2026-09-12
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "c3e5a7b9d1f4"
down_revision = "b2d4f6a8c0e2"
branch_labels = None
depends_on = None

UUIDType = postgresql.UUID(as_uuid=True).with_variant(sa.Uuid(), "sqlite")

# BEFORE, not AFTER: the exception has to fire before the row is touched.
# FOR EACH ROW so the message names the operation that was attempted rather
# than a statement that may have matched nothing.
_CREATE_GUARD = """
CREATE OR REPLACE FUNCTION audit_logs_no_mutate() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'audit_logs is append-only: % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_immutable
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION audit_logs_no_mutate();
"""

_DROP_GUARD = """
DROP TRIGGER IF EXISTS audit_logs_immutable ON audit_logs;
DROP FUNCTION IF EXISTS audit_logs_no_mutate();
"""


def upgrade() -> None:
    op.add_column("audit_logs", sa.Column("prev_id", UUIDType, nullable=True))
    op.add_column("audit_logs", sa.Column("prev_hash", sa.String(length=64), nullable=True))
    # server_default rather than a backfill: any pre-existing row keeps an
    # empty hash, which verification reports as unverifiable rather than as
    # tampered-with. Claiming a hash for a row written before hashing existed
    # would be the log lying about its own integrity.
    op.add_column(
        "audit_logs",
        sa.Column("entry_hash", sa.String(length=64), nullable=False, server_default=""),
    )
    op.create_index("ix_audit_logs_prev_id", "audit_logs", ["prev_id"])

    if op.get_bind().dialect.name == "postgresql":
        op.execute(_CREATE_GUARD)


def downgrade() -> None:
    # The trigger goes first: it guards rows, not schema, so it would not block
    # these drops — but leaving a trigger behind pointing at columns that no
    # longer exist is how a later migration fails for an unrelated reason.
    if op.get_bind().dialect.name == "postgresql":
        op.execute(_DROP_GUARD)

    op.drop_index("ix_audit_logs_prev_id", table_name="audit_logs")
    op.drop_column("audit_logs", "entry_hash")
    op.drop_column("audit_logs", "prev_hash")
    op.drop_column("audit_logs", "prev_id")
