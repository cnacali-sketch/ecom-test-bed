"""Invoices and their number series.

The shop could take money but could not issue the document that proves it. An
Indian B2C sale owes the buyer an invoice carrying the seller's GSTIN, an HSN
code per line, the CGST/SGST or IGST split by place of supply, and a serial
number that does not skip. None of those existed as data, so none could be
printed.

Two tables. `invoices` is a frozen snapshot of what was issued — seller,
buyer, every line and the tax split — so a later price or address change
cannot rewrite a document already in a customer's hands. `invoice_sequences`
holds one counter per financial year: numbering has to be gapless, and a
counter row can be locked before the invoice exists, whereas MAX(sequence)
cannot.

Revision ID: a1c2e3f4b5d6
Revises: d3e4f5a6b7c8
Create Date: 2026-09-11
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "a1c2e3f4b5d6"
down_revision = "d3e4f5a6b7c8"
branch_labels = None
depends_on = None

JSONType = postgresql.JSONB().with_variant(sa.JSON(), "sqlite")


def upgrade() -> None:
    op.create_table(
        "invoice_sequences",
        sa.Column("financial_year", sa.String(8), primary_key=True),
        sa.Column("last_number", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_table(
        "invoices",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("order_id", sa.Uuid(), sa.ForeignKey("orders.id"), nullable=False, index=True),
        sa.Column("number", sa.String(32), nullable=False),
        sa.Column("financial_year", sa.String(8), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column(
            "issued_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("is_tax_invoice", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("seller_name", sa.String(200), nullable=False),
        sa.Column("seller_gstin", sa.String(20), nullable=True),
        sa.Column("seller_address", sa.Text(), nullable=False, server_default=""),
        sa.Column("seller_state", sa.String(100), nullable=False, server_default=""),
        sa.Column("buyer_name", sa.String(200), nullable=False, server_default=""),
        sa.Column("buyer_address", sa.Text(), nullable=False, server_default=""),
        sa.Column("place_of_supply", sa.String(100), nullable=False, server_default=""),
        sa.Column("intra_state", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("taxable_value", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("cgst", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("sgst", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("igst", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("total", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("lines", JSONType, nullable=False, server_default="[]"),
        sa.UniqueConstraint("order_id", name="uq_invoices_order_id"),
        sa.UniqueConstraint("number", name="uq_invoices_number"),
    )


def downgrade() -> None:
    op.drop_table("invoices")
    op.drop_table("invoice_sequences")
