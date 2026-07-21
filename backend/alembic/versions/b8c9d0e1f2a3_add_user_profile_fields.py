"""Add customer profile fields to users (name, phone, postal/billing address).

Addresses are JSONB blobs ({line1, line2, city, state, postcode, country}) so
the shape can flex without a migration per field. `billing_same` flags that
billing mirrors postal.

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2026-07-21
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "b8c9d0e1f2a3"
down_revision = "a7b8c9d0e1f2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("full_name", sa.String(120), nullable=True))
    op.add_column("users", sa.Column("phone", sa.String(32), nullable=True))
    op.add_column("users", sa.Column("postal_address", JSONB(), nullable=False, server_default="{}"))
    op.add_column("users", sa.Column("billing_address", JSONB(), nullable=False, server_default="{}"))
    op.add_column("users", sa.Column("billing_same", sa.Boolean(), nullable=False, server_default="true"))


def downgrade() -> None:
    op.drop_column("users", "billing_same")
    op.drop_column("users", "billing_address")
    op.drop_column("users", "postal_address")
    op.drop_column("users", "phone")
    op.drop_column("users", "full_name")
