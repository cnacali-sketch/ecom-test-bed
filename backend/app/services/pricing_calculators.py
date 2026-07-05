"""Pure pricing calculator functions for the Pricing Agent.

All functions are side-effect-free and raise `ValueError` on invalid input
(zero/negative costs or prices) rather than silently returning garbage
(e.g. division by zero or a negative break-even count).
"""


def markup(cost: float, margin_pct: float) -> float:
    """Compute the retail price from `cost` given a desired `margin_pct`.

    price = cost * (1 + margin_pct / 100)

    Raises:
        ValueError: if `cost` is not strictly positive, or `margin_pct` is negative.
    """
    if cost <= 0:
        raise ValueError("cost must be greater than zero")
    if margin_pct < 0:
        raise ValueError("margin_pct must not be negative")
    return cost * (1 + margin_pct / 100)


def profit_margin(cost: float, price: float) -> float:
    """Compute the profit margin percentage given `cost` and selling `price`.

    margin_pct = (price - cost) / price * 100

    Raises:
        ValueError: if `price` is not strictly positive, or `cost` is negative.
    """
    if price <= 0:
        raise ValueError("price must be greater than zero")
    if cost < 0:
        raise ValueError("cost must not be negative")
    return (price - cost) / price * 100


def break_even(fixed_costs: float, price: float, variable_cost: float) -> float:
    """Compute the number of units that must be sold to cover `fixed_costs`.

    units = fixed_costs / (price - variable_cost)

    Raises:
        ValueError: if `price` is not strictly positive, if `fixed_costs` is
            negative, or if `variable_cost` is greater than or equal to
            `price` (i.e. the contribution margin is not positive, making
            break-even unreachable).
    """
    if price <= 0:
        raise ValueError("price must be greater than zero")
    if fixed_costs < 0:
        raise ValueError("fixed_costs must not be negative")
    contribution_margin = price - variable_cost
    if contribution_margin <= 0:
        raise ValueError("variable_cost must be less than price for break-even to be reachable")
    return fixed_costs / contribution_margin
