"""Issuing invoices.

The arithmetic is covered in test_gst.py. These cover the things that make an
invoice a legal record rather than a calculation: that it is numbered without
gaps, that it is issued once, that it freezes what it says, and that a shop
with no GSTIN produces a bill of supply instead of a tax invoice with zeros in
it.
"""
import uuid
from decimal import Decimal

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.product import Product

_CLIP = uuid.uuid4()
_PENDANT = uuid.uuid4()

KARNATAKA = {
    "full_name": "Praveen Kumar",
    "line1": "12 MG Road",
    "city": "Bengaluru",
    "state": "Karnataka",
    "postcode": "560025",
    "country": "India",
    "phone": "9738281596",
}
KERALA = {**KARNATAKA, "city": "Kochi", "state": "Kerala", "postcode": "682001"}


@pytest.fixture(autouse=True)
def _shop(monkeypatch: pytest.MonkeyPatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "shop_gstin", "29ABCDE1234F1Z5", raising=False)
    monkeypatch.setattr(settings, "shop_legal_name", "Savvy In Teal", raising=False)
    monkeypatch.setattr(settings, "shop_state", "Karnataka", raising=False)
    monkeypatch.setattr(settings, "shop_address", "12 Agah Abdullah Street, Bengaluru", raising=False)
    monkeypatch.setattr(settings, "invoice_prefix", "SIT", raising=False)
    monkeypatch.setattr(settings, "default_hsn", "9615", raising=False)
    monkeypatch.setattr(settings, "default_gst_rate", "18", raising=False)
    yield


@pytest_asyncio.fixture(autouse=True)
async def _seed(db_session: AsyncSession) -> None:
    db_session.add_all(
        [
            Product(
                id=_CLIP,
                sku="SIT-CLIP-1",
                slug="tortoise-claw-clip",
                name="Tortoise Grip Claw Clip",
                price=Decimal("499.00"),
                mrp=Decimal("499.00"),
                in_stock=True,
            ),
            Product(
                id=_PENDANT,
                sku="SIT-PEND-1",
                slug="teal-pendant",
                name="Signature Teal Pendant",
                price=Decimal("500.00"),
                mrp=Decimal("500.00"),
                in_stock=True,
                # Jewellery sits under a different HSN and rate from hair
                # accessories, so one invoice has to carry both.
                attrs={"hsn": "7117", "gstRate": "3"},
            ),
        ]
    )
    await db_session.commit()


async def _paid_order(
    client: AsyncClient, admin_client: AsyncClient, address: dict, items: list[dict] | None = None
) -> str:
    created = await client.post(
        "/api/orders",
        json={
            "user_id": "invoice-test@example.com",
            "items": items
            or [{"product_id": str(_CLIP), "quantity": 1, "unit_price": "499.00"}],
            "shipping_address": address,
            "terms_accepted": True,
            "terms_version": "2026-07-22",
        },
    )
    assert created.status_code == 201, created.text
    order_id = created.json()["id"]
    await admin_client.patch(f"/api/orders/{order_id}/payment?payment_status=paid")
    return order_id


class TestIssuing:
    @pytest.mark.asyncio
    async def test_an_invoice_carries_what_the_law_asks_for(
        self, client: AsyncClient, admin_client: AsyncClient
    ) -> None:
        order_id = await _paid_order(client, admin_client, KARNATAKA)

        resp = await admin_client.post(f"/api/orders/{order_id}/invoice")

        assert resp.status_code == 201, resp.text
        inv = resp.json()
        assert inv["seller_gstin"] == "29ABCDE1234F1Z5"
        assert inv["is_tax_invoice"] is True
        assert inv["buyer_name"] == "Praveen Kumar"
        assert inv["place_of_supply"] == "Karnataka"
        assert inv["number"].startswith("SIT/")
        # An HSN code per line is not optional on a tax invoice.
        assert inv["lines"][0]["hsn"] == "9615"

    @pytest.mark.asyncio
    async def test_numbers_run_consecutively_within_the_financial_year(
        self, client: AsyncClient, admin_client: AsyncClient
    ) -> None:
        """A gap in the series is the thing an auditor looks for first."""
        numbers = []
        for _ in range(3):
            order_id = await _paid_order(client, admin_client, KARNATAKA)
            resp = await admin_client.post(f"/api/orders/{order_id}/invoice")
            numbers.append(resp.json()["number"])

        sequences = [int(n.rsplit("/", 1)[1]) for n in numbers]
        assert sequences == [1, 2, 3]
        assert len(set(numbers)) == 3

    @pytest.mark.asyncio
    async def test_issuing_twice_returns_the_same_invoice(
        self, client: AsyncClient, admin_client: AsyncClient
    ) -> None:
        """Burning a second number on one sale would leave the series
        describing two transactions where there was one."""
        order_id = await _paid_order(client, admin_client, KARNATAKA)

        first = await admin_client.post(f"/api/orders/{order_id}/invoice")
        second = await admin_client.post(f"/api/orders/{order_id}/invoice")

        assert first.json()["number"] == second.json()["number"]
        assert first.json()["id"] == second.json()["id"]

    @pytest.mark.asyncio
    async def test_an_unpaid_order_cannot_be_invoiced(
        self, client: AsyncClient, admin_client: AsyncClient
    ) -> None:
        """A COD order is invoiced when the cash is collected, which is when
        the sale actually happened."""
        created = await client.post(
            "/api/orders",
            json={
                "user_id": "unpaid@example.com",
                "items": [{"product_id": str(_CLIP), "quantity": 1, "unit_price": "499.00"}],
                "shipping_address": KARNATAKA,
                "terms_accepted": True,
                "terms_version": "2026-07-22",
            },
        )

        resp = await admin_client.post(f"/api/orders/{created.json()['id']}/invoice")

        assert resp.status_code == 409
        assert "not paid" in resp.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_issuing_requires_admin(
        self, client: AsyncClient, admin_client: AsyncClient, customer_client: AsyncClient
    ) -> None:
        order_id = await _paid_order(client, admin_client, KARNATAKA)

        assert (await customer_client.post(f"/api/orders/{order_id}/invoice")).status_code == 403
        assert (await customer_client.get(f"/api/orders/{order_id}/invoice")).status_code == 403
        assert (await customer_client.get("/api/invoices")).status_code == 403

    @pytest.mark.asyncio
    async def test_an_order_with_no_invoice_says_so(
        self, client: AsyncClient, admin_client: AsyncClient
    ) -> None:
        order_id = await _paid_order(client, admin_client, KARNATAKA)

        resp = await admin_client.get(f"/api/orders/{order_id}/invoice")

        assert resp.status_code == 404


class TestTaxSplit:
    @pytest.mark.asyncio
    async def test_a_local_sale_splits_into_cgst_and_sgst(
        self, client: AsyncClient, admin_client: AsyncClient
    ) -> None:
        order_id = await _paid_order(client, admin_client, KARNATAKA)

        inv = (await admin_client.post(f"/api/orders/{order_id}/invoice")).json()

        assert inv["intra_state"] is True
        assert Decimal(inv["igst"]) == Decimal("0.00")
        assert Decimal(inv["cgst"]) == Decimal(inv["sgst"])
        assert Decimal(inv["cgst"]) > 0

    @pytest.mark.asyncio
    async def test_a_sale_to_another_state_is_igst(
        self, client: AsyncClient, admin_client: AsyncClient
    ) -> None:
        order_id = await _paid_order(client, admin_client, KERALA)

        inv = (await admin_client.post(f"/api/orders/{order_id}/invoice")).json()

        assert inv["intra_state"] is False
        assert inv["place_of_supply"] == "Kerala"
        assert Decimal(inv["cgst"]) == Decimal("0.00")
        assert Decimal(inv["igst"]) == Decimal("76.12")  # 499 inclusive at 18%

    @pytest.mark.asyncio
    async def test_the_invoice_total_equals_what_the_customer_paid(
        self, client: AsyncClient, admin_client: AsyncClient
    ) -> None:
        """Tax is extracted from the price, never added — the shop's prices
        include it. An invoice totalling more than the order would mean every
        sale was being overstated."""
        order_id = await _paid_order(client, admin_client, KARNATAKA)
        order = (await client.get(f"/api/orders/{order_id}")).json()

        inv = (await admin_client.post(f"/api/orders/{order_id}/invoice")).json()

        assert Decimal(inv["total"]) == Decimal(order["total_amount"])
        assert (
            Decimal(inv["taxable_value"]) + Decimal(inv["cgst"]) + Decimal(inv["sgst"])
            + Decimal(inv["igst"])
        ) == Decimal(inv["total"])

    @pytest.mark.asyncio
    async def test_each_product_is_billed_at_its_own_hsn_and_rate(
        self, client: AsyncClient, admin_client: AsyncClient
    ) -> None:
        order_id = await _paid_order(
            client,
            admin_client,
            KERALA,
            items=[
                {"product_id": str(_CLIP), "quantity": 1, "unit_price": "499.00"},
                {"product_id": str(_PENDANT), "quantity": 1, "unit_price": "500.00"},
            ],
        )

        inv = (await admin_client.post(f"/api/orders/{order_id}/invoice")).json()

        by_hsn = {line["hsn"]: line for line in inv["lines"]}
        assert by_hsn["9615"]["gst_rate"] == "18"
        assert by_hsn["7117"]["gst_rate"] == "3"
        # 500 inclusive at 3% -> 14.56 tax, not the 18% default.
        assert Decimal(by_hsn["7117"]["igst"]) == Decimal("14.56")

    @pytest.mark.asyncio
    async def test_quantity_is_billed_not_just_unit_price(
        self, client: AsyncClient, admin_client: AsyncClient
    ) -> None:
        order_id = await _paid_order(
            client,
            admin_client,
            KERALA,
            items=[{"product_id": str(_CLIP), "quantity": 3, "unit_price": "499.00"}],
        )

        inv = (await admin_client.post(f"/api/orders/{order_id}/invoice")).json()

        assert Decimal(inv["lines"][0]["gross"]) == Decimal("1497.00")
        assert Decimal(inv["total"]) == Decimal("1497.00")


class TestUnregisteredShop:
    @pytest.mark.asyncio
    async def test_no_gstin_produces_a_bill_of_supply_with_no_tax(
        self, client: AsyncClient, admin_client: AsyncClient, monkeypatch
    ) -> None:
        """A shop below the registration threshold is not registered and must
        not issue a tax invoice. Showing a tax invoice with zeros would claim a
        registration that does not exist."""
        monkeypatch.setattr(get_settings(), "shop_gstin", "", raising=False)
        order_id = await _paid_order(client, admin_client, KARNATAKA)

        inv = (await admin_client.post(f"/api/orders/{order_id}/invoice")).json()

        assert inv["is_tax_invoice"] is False
        assert inv["seller_gstin"] is None
        assert Decimal(inv["cgst"]) == Decimal("0.00")
        assert Decimal(inv["igst"]) == Decimal("0.00")
        # The whole amount is the sale value; none of it was tax.
        assert Decimal(inv["taxable_value"]) == Decimal(inv["total"])
        assert inv["lines"][0]["gst_rate"] == "0"


class TestSnapshot:
    @pytest.mark.asyncio
    async def test_renaming_a_product_does_not_rewrite_an_issued_invoice(
        self, client: AsyncClient, admin_client: AsyncClient, db_session: AsyncSession
    ) -> None:
        """An invoice is a record of what was sold, not a live view of the
        catalogue. A later correction must not change a document already in a
        customer's hands."""
        from sqlalchemy import select

        order_id = await _paid_order(client, admin_client, KARNATAKA)
        issued = (await admin_client.post(f"/api/orders/{order_id}/invoice")).json()
        assert issued["lines"][0]["description"] == "Tortoise Grip Claw Clip"

        product = (
            await db_session.execute(select(Product).where(Product.id == _CLIP))
        ).scalar_one()
        product.name = "Renamed Later"
        product.attrs = {"hsn": "9999", "gstRate": "28"}
        await db_session.commit()

        fetched = (await admin_client.get(f"/api/orders/{order_id}/invoice")).json()

        assert fetched["lines"][0]["description"] == "Tortoise Grip Claw Clip"
        assert fetched["lines"][0]["hsn"] == "9615"
        assert fetched["total"] == issued["total"]

    @pytest.mark.asyncio
    async def test_the_register_lists_every_invoice(
        self, client: AsyncClient, admin_client: AsyncClient
    ) -> None:
        for _ in range(2):
            order_id = await _paid_order(client, admin_client, KARNATAKA)
            await admin_client.post(f"/api/orders/{order_id}/invoice")

        resp = await admin_client.get("/api/invoices")

        assert resp.status_code == 200
        assert len(resp.json()) == 2
