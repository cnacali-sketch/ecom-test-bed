"""The admin action log.

Until now the database recorded the *result* of an admin action but never the
action itself: an order could go from paid to refunded with nothing anywhere
saying who did it or what it looked like first. That was survivable while one
person held the only admin account. It stops being survivable the moment a
second person can sign in, which is what the staff role introduces.

One table, append-only by convention. The actor's email and role are copied
onto each row rather than joined from `users`, so deleting an account does not
erase what that account did, and an entry written last month keeps saying what
role the actor held last month.

Revision ID: b2d4f6a8c0e2
Revises: a1c2e3f4b5d6
Create Date: 2026-09-11
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "b2d4f6a8c0e2"
down_revision = "a1c2e3f4b5d6"
branch_labels = None
depends_on = None

JSONType = postgresql.JSONB().with_variant(sa.JSON(), "sqlite")


def upgrade() -> None:
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        # No ForeignKey to users.id on purpose — a deleted account must not
        # take its history with it.
        sa.Column("actor_id", sa.Uuid(), nullable=True),
        sa.Column("actor_email", sa.String(320), nullable=False),
        sa.Column("actor_role", sa.String(16), nullable=False),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("entity_type", sa.String(32), nullable=False),
        sa.Column("entity_id", sa.Uuid(), nullable=True),
        sa.Column("entity_label", sa.String(160), nullable=True),
        sa.Column("summary", sa.String(300), nullable=False),
        sa.Column("changes", JSONType, nullable=False, server_default="{}"),
        sa.Column("ip", sa.String(64), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_audit_logs_actor_id", "audit_logs", ["actor_id"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])
    op.create_index("ix_audit_logs_entity", "audit_logs", ["entity_type", "entity_id"])


def downgrade() -> None:
    op.drop_index("ix_audit_logs_entity", table_name="audit_logs")
    op.drop_index("ix_audit_logs_created_at", table_name="audit_logs")
    op.drop_index("ix_audit_logs_action", table_name="audit_logs")
    op.drop_index("ix_audit_logs_actor_id", table_name="audit_logs")
    op.drop_table("audit_logs")
