"""GST arithmetic for an Indian storefront.

Kept as pure functions with no database and no request, because this is the
part where being wrong is expensive and quiet: a rounding rule applied in the
wrong order changes what is remitted, and nobody notices until a return is
filed.

Two facts drive every calculation here.

**Prices on this shop include tax.** The storefront says "MRP incl. of all
taxes", so tax is *extracted* from the price, never added to it. A ₹499 clip at
18% is ₹422.88 taxable plus ₹76.12 tax — not ₹499 plus ₹89.82. Getting this
backwards overstates every invoice and every liability.

**Where the parcel goes decides which tax applies.** Same state as the seller
means CGST + SGST, half the rate each. Any other state means IGST at the full
rate. The total is identical either way; the split is what the return needs.

The rate itself is never assumed here — it is passed in, sourced from the
product or the shop default, because HSN classification and its rate are the
shop's decision to make with their accountant, not something to hardcode.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

PAISE = Decimal("0.01")


def _round(value: Decimal) -> Decimal:
    """Round to paise, half-up.

    Half-up, not Python's default banker's rounding: half-up is what Indian
    invoicing and every accountant checking this by hand expects, and
    ROUND_HALF_EVEN on a long invoice drifts away from a manual total.
    """
    return value.quantize(PAISE, rounding=ROUND_HALF_UP)


@dataclass(frozen=True)
class LineTax:
    """One invoice line, with tax pulled out of a tax-inclusive price."""

    taxable_value: Decimal
    cgst: Decimal
    sgst: Decimal
    igst: Decimal
    total: Decimal

    @property
    def tax_total(self) -> Decimal:
        return _round(self.cgst + self.sgst + self.igst)


def split_inclusive(
    gross: Decimal, rate_percent: Decimal, *, intra_state: bool
) -> LineTax:
    """Split a tax-inclusive amount into taxable value and tax.

    `gross` is what the customer pays for the line. `rate_percent` is the total
    GST rate (18 means 18%), which is then halved between CGST and SGST for an
    intra-state sale.

    Rounded once, at the end, on each component. Rounding the taxable value
    first and deriving tax from the rounded figure lets a paise of error into
    every line, and on a multi-line invoice those add up to a total that does
    not match what was charged.
    """
    if gross < 0:
        raise ValueError("gross cannot be negative")
    if rate_percent < 0:
        raise ValueError("rate cannot be negative")

    rate = Decimal(rate_percent) / Decimal(100)
    taxable = Decimal(gross) / (Decimal(1) + rate)
    tax = Decimal(gross) - taxable

    if intra_state:
        half = tax / 2
        cgst, sgst, igst = _round(half), _round(half), Decimal("0.00")
    else:
        cgst, sgst, igst = Decimal("0.00"), Decimal("0.00"), _round(tax)

    # The taxable value is derived from the rounded tax rather than rounded on
    # its own, so taxable + tax always equals exactly what was charged. A line
    # whose parts do not add back to its gross is the single most common thing
    # an auditor picks up.
    taxable_rounded = _round(Decimal(gross)) - (cgst + sgst + igst)
    return LineTax(
        taxable_value=taxable_rounded,
        cgst=cgst,
        sgst=sgst,
        igst=igst,
        total=_round(Decimal(gross)),
    )


def is_intra_state(seller_state: str, buyer_state: str) -> bool:
    """Same state means CGST + SGST; anything else means IGST.

    Compared case- and whitespace-insensitively because the buyer types their
    own state into a checkout field — "karnataka ", "Karnataka" and "KARNATAKA"
    are the same place, and treating them as different silently switches a sale
    to IGST and misreports it.

    An unknown or blank buyer state falls back to inter-state (IGST). That is
    the safer error: IGST wrongly charged is corrected in a return, whereas
    CGST+SGST wrongly charged means tax paid to the wrong government.
    """
    if not buyer_state or not buyer_state.strip():
        return False
    return seller_state.strip().casefold() == buyer_state.strip().casefold()


@dataclass(frozen=True)
class InvoiceTotals:
    taxable_value: Decimal
    cgst: Decimal
    sgst: Decimal
    igst: Decimal
    total: Decimal


def sum_lines(lines: list[LineTax]) -> InvoiceTotals:
    """Add the lines up. Components are summed independently so the invoice
    total always equals the sum of the line totals actually printed."""
    zero = Decimal("0.00")
    return InvoiceTotals(
        taxable_value=_round(sum((l.taxable_value for l in lines), zero)),
        cgst=_round(sum((l.cgst for l in lines), zero)),
        sgst=_round(sum((l.sgst for l in lines), zero)),
        igst=_round(sum((l.igst for l in lines), zero)),
        total=_round(sum((l.total for l in lines), zero)),
    )


def financial_year(when) -> str:
    """India's financial year runs April to March: "26-27".

    Invoice numbers restart each financial year, so this is what the series is
    keyed on. A January sale belongs to the year that started the previous
    April, which is the off-by-one worth being explicit about.
    """
    year = when.year
    start = year if when.month >= 4 else year - 1
    return f"{start % 100:02d}-{(start + 1) % 100:02d}"
