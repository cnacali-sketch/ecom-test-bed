"""Schemas for the public checkout-terms endpoint."""
from pydantic import BaseModel, Field


class CheckoutTerms(BaseModel):
    """Money rules the storefront must state before an order is placed."""

    cod_deposit_amount: int = Field(
        description=(
            "Non-refundable confirmation deposit, in INR, collected online when a "
            "Cash-on-Delivery order is placed. The balance (total - deposit) is "
            "collected on delivery. An order totalling less than this cannot use "
            "Cash on Delivery at all."
        )
    )
