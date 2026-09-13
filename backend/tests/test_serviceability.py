"""The shop only delivers to Bengaluru for now.

This is the gate that decides who can buy at all, so the cases that matter are
the ones where being wrong is invisible: a real Bengaluru neighbourhood refused
because the postal data files it oddly, or the whole shop closing itself
because a config field was empty.
"""
import uuid

import pytest

from app.services import pincode, serviceability
from app.services.serviceability import Area, area_from_document, check

BENGALURU = {"serviceability": {"limitedArea": True, "districts": ["Bengaluru", "Bangalore Rural"]}}


def _area(document=None) -> Area:
    return area_from_document(document if document is not None else BENGALURU)


class TestConfiguration:
    def test_a_document_with_no_serviceability_block_still_limits(self):
        """Production's stored document predates this feature and has no such
        key. Reading that as "deliver everywhere" would silently not apply the
        restriction the shop asked for."""
        assert area_from_document({}).limited is True
        assert area_from_document(None).limited is True

    def test_the_limit_can_be_switched_off(self):
        area = area_from_document({"serviceability": {"limitedArea": False}})

        assert area.covers("Anywhere At All") is True

    def test_an_empty_district_list_opens_up_rather_than_closing_down(self):
        """An admin clearing the list means "stop limiting", not "refuse
        everyone". The other reading takes the shop offline without saying so."""
        area = area_from_document({"serviceability": {"limitedArea": True, "districts": []}})

        assert area.covers("Chennai") is True

    @pytest.mark.parametrize("junk", [{"serviceability": []}, {"serviceability": "yes"}])
    def test_a_malformed_block_falls_back_to_the_intended_rule(self, junk):
        assert area_from_document(junk).covers("Bengaluru") is True
        assert area_from_document(junk).covers("Chennai") is False

    def test_district_matching_ignores_case_and_spacing(self):
        assert _area().covers("  bengaluru ") is True


class TestRealAddresses:
    """Measured against the bundled dataset, not invented."""

    @pytest.mark.parametrize(
        ("postcode", "where"),
        [
            ("560001", "MG Road"),
            ("560034", "Koramangala"),
            ("560066", "Whitefield"),
            ("560100", "Electronics City"),
            ("560102", "HSR Layout"),
            ("560068", "Bommanahalli"),
        ],
    )
    def test_a_bengaluru_address_is_deliverable(self, postcode, where):
        """560068 is the one to watch: Bommanahalli files under *Bangalore
        Rural*, not Bengaluru, so listing only one district would refuse a
        dense residential area of the city."""
        assert check(postcode, _area()).deliverable is True, where

    @pytest.mark.parametrize(
        ("postcode", "where"),
        [("400001", "Mumbai"), ("682001", "Kochi"), ("110001", "Delhi"), ("561206", "Kolar")],
    )
    def test_an_address_elsewhere_is_not(self, postcode, where):
        """561206 matters: it starts 561, inside Bengaluru's prefix range, but
        is in Kolar. Matching on the postcode prefix instead of the district
        would have delivered to another town."""
        assert check(postcode, _area()).deliverable is False, where


class TestFailingOpen:
    def test_an_unverifiable_postcode_is_delivered_to(self, monkeypatch):
        """A third party being unreachable must not cost a sale. The order is
        taken and left for a human rather than refused by a timeout."""
        monkeypatch.setattr(
            pincode, "verify", lambda p: pincode.Verdict(known_bad=False, place=None, unverified=True)
        )

        decision = check("560001", _area())

        assert decision.deliverable is True
        assert decision.unverified is True

    @pytest.mark.parametrize("postcode", ["", "abc", "12345", "000000"])
    def test_an_unusable_postcode_is_not_refused_here(self, postcode):
        """Rejecting a malformed postcode is the address validator's job, and
        it has a message that explains itself. This gate saying "we don't
        deliver to your area" about `abc` would just be confusing."""
        assert check(postcode, _area()).deliverable is True


class TestTheGateAtCheckout:
    """Through HTTP, because the gate is only real if the endpoint applies it."""

    @pytest.fixture(autouse=True)
    def _limit_to_bengaluru(self, monkeypatch):
        # Undo conftest's suite-wide "deliver everywhere".
        monkeypatch.setattr(serviceability, "area_from_document", lambda document: _area())

    @staticmethod
    def _payload(postcode: str) -> dict:
        return {
            "user_id": "waitlist-test@example.com",
            "items": [{"product_id": str(uuid.uuid4()), "quantity": 1, "unit_price": "100.00"}],
            "shipping_address": {
                "full_name": "Test Buyer",
                "line1": "1 Test Street",
                "city": "Somewhere",
                "state": "Karnataka",
                "postcode": postcode,
                "phone": "9876500011",
            },
            "terms_accepted": True,
            "terms_version": "2026-07-27",
        }

    @pytest.mark.asyncio
    async def test_an_order_from_outside_the_area_is_refused_with_a_way_forward(self, client):
        response = await client.post("/api/orders", json=self._payload("400001"))

        assert response.status_code == 409
        # Not 422: nothing is wrong with the address. Being told "invalid" about
        # your own correct address is the wrong sentence.
        assert "waitlist" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_an_order_from_bengaluru_is_not(self, client):
        response = await client.post("/api/orders", json=self._payload("560034"))

        assert response.status_code != 409

    @pytest.mark.asyncio
    async def test_an_admin_can_still_place_an_order_anywhere(self, admin_client):
        """Phone and manual orders skip the gate, like they skip the T&C
        checkbox: an admin keying one in has already decided to deliver it."""
        response = await admin_client.post("/api/orders", json=self._payload("400001"))

        assert response.status_code != 409

    @pytest.mark.asyncio
    async def test_an_approved_waitlist_entry_opens_that_postcode(self, client, admin_client):
        """The exception mechanism, end to end: refused, asks, approved, buys."""
        assert (await client.post("/api/orders", json=self._payload("400001"))).status_code == 409

        signup = await client.post(
            "/api/waitlist",
            json={
                "name": "Hopeful Buyer",
                "email": "hopeful@example.com",
                "phone": "9876500022",
                "postcode": "400001",
            },
        )
        assert signup.status_code == 201

        approved = await admin_client.patch(
            f"/api/waitlist/{signup.json()['id']}", json={"status": "approved"}
        )
        assert approved.status_code == 200

        assert (await client.post("/api/orders", json=self._payload("400001"))).status_code != 409
