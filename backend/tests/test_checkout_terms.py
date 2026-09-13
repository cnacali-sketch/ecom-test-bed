"""The storefront asks this endpoint what it is allowed to promise a shopper.

The dialog a customer agrees to states two numbers: what comes out of their
card now, and what they owe the courier at the door. Those numbers have to be
the ones the server will actually apply, which is the whole reason this
endpoint exists instead of a constant in the checkout page.
"""
import pytest

from app.config import get_settings


@pytest.mark.asyncio
async def test_terms_are_public(client):
    """Guest checkout has no account, so this cannot require one."""
    response = await client.get("/api/checkout/terms")

    assert response.status_code == 200


@pytest.mark.asyncio
async def test_terms_report_the_deposit_the_server_will_charge(client):
    response = await client.get("/api/checkout/terms")

    assert response.json()["cod_deposit_amount"] == get_settings().cod_deposit_amount


@pytest.mark.asyncio
async def test_a_changed_deposit_is_reported_not_cached(client):
    """The failure this endpoint exists to prevent.

    Raising the deposit on the server used to leave the storefront promising
    the old split while the backend collected the new one -- the shopper would
    have agreed to one number and been charged another.
    """
    settings = get_settings()
    original = settings.cod_deposit_amount
    settings.cod_deposit_amount = 350
    try:
        response = await client.get("/api/checkout/terms")
        assert response.json()["cod_deposit_amount"] == 350
    finally:
        settings.cod_deposit_amount = original


@pytest.mark.asyncio
async def test_terms_say_nothing_about_any_particular_basket(client):
    """It describes a rule, not a cart -- so it leaks nothing and stays cacheable."""
    body = await client.get("/api/checkout/terms")

    assert set(body.json()) == {"cod_deposit_amount"}
