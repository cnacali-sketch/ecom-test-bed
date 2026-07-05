"""Pure pricing calculator functions for the Pricing Agent.

All functions are side-effect-free and raise `ValueError` on invalid input.
Types use Decimal throughout so results are exact and safe for invoicing.
"""
from decimal import Decimal


def markup(cost: Decimal, margin_pct: Decimal) -> Decimal:
    """price = cost * (1 + margin_pct / 100)"""
    cost, margin_pct = Decimal(str(cost)), Decimal(str(margin_pct))
    if cost <= 0:
        raise ValueError("cost must be greater than zero")
    if margin_pct < 0:
        raise ValueError("margin_pct must not be negative")
    return cost * (1 + margin_pct / Decimal("100"))


def profit_margin(cost: Decimal, price: Decimal) -> Decimal:
    """margin_pct = (price - cost) / price * 100"""
    cost, price = Decimal(str(cost)), Decimal(str(price))
    if price <= 0:
        raise ValueError("price must be greater than zero")
    if cost < 0:
        raise ValueError("cost must not be negative")
    return (price - cost) / price * Decimal("100")


def break_even(fixed_costs: Decimal, price: Decimal, variable_cost: Decimal) -> Decimal:
    """units = fixed_costs / (price - variable_cost)"""
    fixed_costs, price, variable_cost = Decimal(str(fixed_costs)), Decimal(str(price)), Decimal(str(variable_cost))
    if price <= 0:
        raise ValueError("price must be greater than zero")
    if fixed_costs < 0:
        raise ValueError("fixed_costs must not be negative")
    contribution = price - variable_cost
    if contribution <= 0:
        raise ValueError("variable_cost must be less than price")
    return fixed_costs / contribution
