"""Tests for the GST arithmetic.

Every figure here was worked out by hand. The point of these is not that the
code runs — it is that the numbers are the ones an accountant would write, and
that the parts of an invoice add back to what the customer was actually
charged.
"""
from datetime import datetime
from decimal import Decimal

import pytest

from app.services.gst import (
    financial_year,
    is_intra_state,
    split_inclusive,
    sum_lines,
)


class TestInclusivePricing:
    """The shop's prices include tax, so tax is extracted, never added."""

    def test_tax_is_pulled_out_of_the_price_not_added_to_it(self) -> None:
        # 499 inclusive at 18%: 499 / 1.18 = 422.881... -> tax 76.12
        line = split_inclusive(Decimal("499.00"), Decimal("18"), intra_state=False)

        assert line.total == Decimal("499.00")
        assert line.igst == Decimal("76.12")
        assert line.taxable_value == Decimal("422.88")
        # The failure mode this guards: 499 + 18% = 588.82, which would
        # overstate the invoice and the liability on every single sale.
        assert line.total == Decimal("499.00")

    def test_the_parts_always_add_back_to_what_was_charged(self) -> None:
        """An auditor's first check, and the one rounding quietly breaks."""
        for gross in ["1.00", "0.01", "99.99", "499.00", "1299.50", "33333.33"]:
            for rate in ["0", "3", "5", "12", "18", "28"]:
                line = split_inclusive(Decimal(gross), Decimal(rate), intra_state=True)
                assert line.taxable_value + line.tax_total == Decimal(gross), (gross, rate)

    def test_a_zero_rate_leaves_the_whole_amount_taxable(self) -> None:
        line = split_inclusive(Decimal("499.00"), Decimal("0"), intra_state=True)

        assert line.taxable_value == Decimal("499.00")
        assert line.tax_total == Decimal("0.00")

    def test_zero_amount_is_not_an_error(self) -> None:
        """A fully discounted line is legitimate and must not blow up."""
        line = split_inclusive(Decimal("0.00"), Decimal("18"), intra_state=True)

        assert line.total == Decimal("0.00")
        assert line.taxable_value == Decimal("0.00")

    @pytest.mark.parametrize("gross,rate", [("-1.00", "18"), ("100.00", "-5")])
    def test_negative_inputs_are_refused(self, gross: str, rate: str) -> None:
        with pytest.raises(ValueError):
            split_inclusive(Decimal(gross), Decimal(rate), intra_state=True)


class TestPlaceOfSupply:
    """Same state splits the tax in two; anywhere else it is one IGST line."""

    def test_intra_state_splits_the_tax_in_half(self) -> None:
        line = split_inclusive(Decimal("499.00"), Decimal("18"), intra_state=True)

        assert line.cgst == Decimal("38.06")
        assert line.sgst == Decimal("38.06")
        assert line.igst == Decimal("0.00")
        assert line.tax_total == Decimal("76.12")

    def test_inter_state_is_a_single_igst_amount(self) -> None:
        line = split_inclusive(Decimal("499.00"), Decimal("18"), intra_state=False)

        assert line.cgst == Decimal("0.00")
        assert line.sgst == Decimal("0.00")
        assert line.igst == Decimal("76.12")

    def test_the_customer_pays_the_same_either_way(self) -> None:
        """The split is for the return, not the shopper. If the totals
        differed, the same product would cost different amounts depending on
        the delivery address."""
        intra = split_inclusive(Decimal("1299.00"), Decimal("18"), intra_state=True)
        inter = split_inclusive(Decimal("1299.00"), Decimal("18"), intra_state=False)

        assert intra.total == inter.total == Decimal("1299.00")

    def test_cgst_and_sgst_are_always_exactly_equal(self) -> None:
        """A hard formatting rule on an Indian invoice, and the reason the
        intra-state tax can land a paise away from the inter-state figure.

        ₹1299 at 18% is ₹198.1525… of tax. Halved and rounded, CGST and SGST
        are ₹99.08 each — ₹198.16 together, a paise above the ₹198.15 an IGST
        line would show. Equal halves win: the alternative is an invoice with
        CGST ≠ SGST, which is wrong on its face. The customer still pays
        ₹1299 either way, because the taxable value absorbs the difference.
        """
        for gross in ["1299.00", "499.00", "0.99", "12345.67"]:
            line = split_inclusive(Decimal(gross), Decimal("18"), intra_state=True)
            assert line.cgst == line.sgst, gross
            assert line.taxable_value + line.tax_total == Decimal(gross), gross

    def test_the_split_never_drifts_more_than_a_paise_from_the_rate(self) -> None:
        """Equal halves are allowed to cost a paise; they are not allowed to
        cost more than that, which would mean the rate was applied wrongly."""
        for gross in ["1299.00", "499.00", "0.99", "12345.67", "7777.77"]:
            exact = Decimal(gross) - (Decimal(gross) / Decimal("1.18"))
            line = split_inclusive(Decimal(gross), Decimal("18"), intra_state=True)
            assert abs(line.tax_total - exact) <= Decimal("0.01"), gross

    @pytest.mark.parametrize(
        "buyer,expected",
        [
            ("Karnataka", True),
            ("karnataka", True),
            ("  KARNATAKA  ", True),
            ("Kerala", False),
            ("Tamil Nadu", False),
        ],
    )
    def test_state_matching_ignores_case_and_padding(self, buyer: str, expected: bool) -> None:
        """The buyer types this into a checkout field by hand. Treating
        "karnataka" as a different place from "Karnataka" would switch a local
        sale to IGST and misreport it."""
        assert is_intra_state("Karnataka", buyer) is expected

    @pytest.mark.parametrize("buyer", ["", "   ", None])
    def test_a_missing_state_is_treated_as_inter_state(self, buyer) -> None:
        """The safer error. IGST charged wrongly is fixed in a return; CGST and
        SGST charged wrongly means tax paid to the wrong government."""
        assert is_intra_state("Karnataka", buyer) is False


class TestInvoiceTotals:
    def test_totals_are_the_sum_of_the_lines_as_printed(self) -> None:
        lines = [
            split_inclusive(Decimal("499.00"), Decimal("18"), intra_state=True),
            split_inclusive(Decimal("299.00"), Decimal("18"), intra_state=True),
            split_inclusive(Decimal("1299.00"), Decimal("18"), intra_state=True),
        ]

        totals = sum_lines(lines)

        assert totals.total == Decimal("2097.00")
        assert totals.taxable_value + totals.cgst + totals.sgst + totals.igst == Decimal("2097.00")

    def test_mixed_rates_on_one_invoice(self) -> None:
        """Jewellery and hair accessories can sit under different HSN codes at
        different rates, so one invoice has to carry both."""
        lines = [
            split_inclusive(Decimal("500.00"), Decimal("3"), intra_state=False),
            split_inclusive(Decimal("500.00"), Decimal("18"), intra_state=False),
        ]

        totals = sum_lines(lines)

        assert totals.total == Decimal("1000.00")
        # 500/1.03 -> 14.56 tax; 500/1.18 -> 76.27 tax
        assert totals.igst == Decimal("90.83")

    def test_an_empty_invoice_totals_zero(self) -> None:
        totals = sum_lines([])
        assert totals.total == Decimal("0.00")


class TestFinancialYear:
    @pytest.mark.parametrize(
        "when,expected",
        [
            (datetime(2026, 4, 1), "26-27"),
            (datetime(2026, 9, 11), "26-27"),
            (datetime(2027, 3, 31), "26-27"),
            # The off-by-one worth being explicit about: a January sale belongs
            # to the year that began the previous April.
            (datetime(2027, 1, 15), "26-27"),
            (datetime(2027, 4, 1), "27-28"),
            (datetime(2026, 3, 31), "25-26"),
        ],
    )
    def test_year_runs_april_to_march(self, when: datetime, expected: str) -> None:
        assert financial_year(when) == expected
