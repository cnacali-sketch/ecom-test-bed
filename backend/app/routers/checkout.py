"""Checkout terms the storefront has to state before taking money.

Public and unauthenticated, because checkout is: a guest reaches it without an
account. Nothing here touches the database or reads anything about the caller;
it reports settings the shopper is about to be charged under.

This exists because the checkout page was hardcoding the Cash-on-Delivery
deposit as `const COD_DEPOSIT = 200` with a comment asking whoever changed the
backend to remember to change it here too. That is survivable for a label. It
is not survivable for a confirmation dialog the shopper agrees to, which is a
representation about money: raise COD_DEPOSIT_AMOUNT on the server and the
shop would have gone on promising the old split while charging the new one.
"""
from fastapi import APIRouter

from app.config import get_settings
from app.schemas.checkout import CheckoutTerms

router = APIRouter(prefix="/api/checkout", tags=["checkout"])


@router.get("/terms", response_model=CheckoutTerms)
async def read_checkout_terms() -> CheckoutTerms:
    """The money rules the storefront must show before an order is placed.

    Deliberately only the deposit. Totals, discounts and per-line prices stay
    server-authoritative at order creation -- this endpoint describes the rule,
    never a particular basket, so it can be cached and cannot be used to probe
    anyone's cart.
    """
    return CheckoutTerms(cod_deposit_amount=get_settings().cod_deposit_amount)
