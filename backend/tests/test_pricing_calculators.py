"""Unit tests for app.services.pricing_calculators (pure functions, no I/O)."""
import pytest

from app.services.pricing_calculators import break_even, markup, profit_margin


class TestMarkup:
    def test_markup_from_cost_and_margin_pct(self):
        # Arrange
        cost = 50.0
        margin_pct = 20.0

        # Act
        price = markup(cost, margin_pct)

        # Assert
        assert price == pytest.approx(60.0)

    def test_markup_zero_margin_returns_cost(self):
        assert markup(100.0, 0.0) == pytest.approx(100.0)

    def test_markup_raises_on_zero_cost(self):
        with pytest.raises(ValueError):
            markup(0.0, 20.0)

    def test_markup_raises_on_negative_cost(self):
        with pytest.raises(ValueError):
            markup(-10.0, 20.0)

    def test_markup_raises_on_negative_margin(self):
        with pytest.raises(ValueError):
            markup(50.0, -5.0)


class TestProfitMargin:
    def test_profit_margin_from_cost_and_price(self):
        # Arrange
        cost = 50.0
        price = 100.0

        # Act
        margin_pct = profit_margin(cost, price)

        # Assert
        assert margin_pct == pytest.approx(50.0)

    def test_profit_margin_raises_on_zero_price(self):
        with pytest.raises(ValueError):
            profit_margin(50.0, 0.0)

    def test_profit_margin_raises_on_negative_price(self):
        with pytest.raises(ValueError):
            profit_margin(50.0, -1.0)

    def test_profit_margin_raises_on_negative_cost(self):
        with pytest.raises(ValueError):
            profit_margin(-5.0, 100.0)

    def test_profit_margin_allows_zero_cost(self):
        # A free item sold at any price has 100% margin
        assert profit_margin(0.0, 100.0) == pytest.approx(100.0)


class TestBreakEven:
    def test_break_even_units(self):
        # Arrange: fixed_costs=1000, price=50/unit, variable_cost=30/unit
        # contribution margin = 20/unit -> break-even units = 50
        fixed_costs = 1000.0
        price = 50.0
        variable_cost = 30.0

        # Act
        units = break_even(fixed_costs, price, variable_cost)

        # Assert
        assert units == pytest.approx(50.0)

    def test_break_even_raises_on_zero_price(self):
        with pytest.raises(ValueError):
            break_even(1000.0, 0.0, 10.0)

    def test_break_even_raises_when_variable_cost_exceeds_price(self):
        # Contribution margin would be <= 0, break-even is impossible
        with pytest.raises(ValueError):
            break_even(1000.0, 20.0, 30.0)

    def test_break_even_raises_on_negative_fixed_costs(self):
        with pytest.raises(ValueError):
            break_even(-100.0, 50.0, 30.0)

    def test_break_even_zero_fixed_costs_returns_zero_units(self):
        assert break_even(0.0, 50.0, 30.0) == pytest.approx(0.0)
