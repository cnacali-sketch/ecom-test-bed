"""Invoice and its number series.

An invoice is a **snapshot**, not a view. Once issued it must keep saying what
it said, even after the product is renamed, its price changes, its HSN code is
corrected or the shop's address moves. Everything it prints is therefore
copied onto the row at the moment of issue — seller details, buyer details,
every line, and the tax split.

`InvoiceSequence` exists because invoice numbers have to be consecutive with no
gaps, restarting each financial year. Deriving the next number from
MAX(sequence) cannot be locked before the row exists, so the counter is a row
of its own that can be locked and incremented.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from sqlalchemy.types import JSON

from app.db import Base

JSONType = JSONB().with_variant(JSON(), "sqlite")


class InvoiceSequence(Base):
    """One row per financial year, holding the last number issued."""

    __tablename__ = "invoice_sequences"

    financial_year: Mapped[str] = mapped_column(String(8), primary_key=True)
    last_number: Mapped[int] = mapped_column(Integer, default=0, server_default="0")


class Invoice(Base):
    __tablename__ = "invoices"
    __table_args__ = (
        # One invoice per order. Issuing a second one for the same sale would
        # put two numbers against one transaction, which is precisely what a
        # gapless series is meant to prevent.
        UniqueConstraint("order_id", name="uq_invoices_order_id"),
        UniqueConstraint("number", name="uq_invoices_number"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("orders.id"), index=True)

    # "SIT/26-27/0001" — prefix, financial year, then the sequence within it.
    number: Mapped[str] = mapped_column(String(32))
    financial_year: Mapped[str] = mapped_column(String(8))
    sequence: Mapped[int] = mapped_column(Integer)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # False when the shop has no GSTIN: an unregistered seller must issue a
    # bill of supply with no tax lines, not a tax invoice.
    is_tax_invoice: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")

    seller_name: Mapped[str] = mapped_column(String(200))
    seller_gstin: Mapped[str | None] = mapped_column(String(20), nullable=True)
    seller_address: Mapped[str] = mapped_column(Text(), default="")
    seller_state: Mapped[str] = mapped_column(String(100), default="")

    buyer_name: Mapped[str] = mapped_column(String(200), default="")
    buyer_address: Mapped[str] = mapped_column(Text(), default="")
    # Where the goods are delivered — this is what decides the tax split, and
    # it has to appear on the invoice for an inter-state sale.
    place_of_supply: Mapped[str] = mapped_column(String(100), default="")
    intra_state: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")

    taxable_value: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0"))
    cgst: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0"))
    sgst: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0"))
    igst: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0"))
    total: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0"))

    # Frozen copy of every line: description, hsn, qty, rate, taxable, tax.
    # Stored rather than recomputed so a later price or HSN correction cannot
    # rewrite an invoice that has already gone to a customer.
    lines: Mapped[list] = mapped_column(JSONType, default=list, server_default="[]")
