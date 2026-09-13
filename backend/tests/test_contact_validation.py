"""Format rules for emails, phones, postcodes, names and street lines.

The same table of cases is asserted in `frontend/lib/contact-validation.test.ts`
against the mirrored TypeScript. Two implementations of one rule set drift
silently, and the drift only shows up as a shopper being refused by one half and
accepted by the other, so the cases here are deliberately the same cases --
changing one side without the other should break a test, not a customer.

The dangerous failure is the quiet one: a real customer turned away tells you
nothing, they just leave. So the accept-cases below matter more than the
reject-cases.
"""
import pytest

from app.services import contact_validation as cv


class TestPhone:
    @pytest.mark.parametrize(
        ("value", "why"),
        [
            ("+91 98765 43210", "country code and spaces"),
            ("098765 43210", "trunk zero"),
            ("0091-98765-43210", "0091 prefix"),
            ("9876543211", "bare"),
        ],
    )
    def test_the_ways_people_actually_type_it_all_reduce_to_ten_digits(self, value, why):
        assert len(cv.normalise_phone(value)) == 10, why

    @pytest.mark.parametrize("value", ["0000000000", "1234567890", "9876543210"])
    def test_filler_is_refused(self, value):
        assert cv.check_phone(value) is not None

    @pytest.mark.parametrize("value", ["12345", "", "abcdefghij"])
    def test_a_non_number_is_refused(self, value):
        assert cv.check_phone(value) is not None

    def test_a_landline_is_refused_and_told_to_use_a_mobile(self):
        """Deliberate: the courier rings this before attempting delivery. Told
        only "invalid phone", someone would be staring at a working number."""
        assert "mobile" in cv.check_phone("011-23456789")

    @pytest.mark.parametrize("value", ["6000000001", "7012345679", "8123456780", "9812345671"])
    def test_a_real_mobile_is_accepted(self, value):
        assert cv.check_phone(value) is None


class TestEmail:
    @pytest.mark.parametrize(
        "value", ["@", "a@b", "no-at-sign.com", "two@@at.com", "trailing@dot.", ""]
    )
    def test_an_incomplete_address_is_refused(self, value):
        assert cv.check_email(value) is not None

    @pytest.mark.parametrize(
        "value", ["someone@gmail.com", "first.last+tag@sub.domain.co.in", "a_b-c@example.org"]
    )
    def test_a_real_address_is_accepted(self, value):
        assert cv.check_email(value) is None

    def test_a_likely_typo_is_suggested_not_refused(self):
        """gmial.com is a real domain. Refusing it would be us being
        confidently wrong about someone's own address."""
        assert cv.check_email("someone@gmial.com") is None
        assert cv.suggest_email("someone@gmial.com") == "someone@gmail.com"

    def test_an_address_that_is_already_right_is_not_corrected(self):
        assert cv.suggest_email("someone@gmail.com") is None


class TestName:
    @pytest.mark.parametrize("value", ["a", "", "1234", "aaaa"])
    def test_a_non_name_is_refused(self, value):
        assert cv.check_name(value) is not None

    @pytest.mark.parametrize(
        ("value", "why"),
        [
            ("Ravi", "a mononym"),
            ("R K Narayan", "initials"),
            ("D'Souza", "an apostrophe"),
            ("ಸವ್ಯ", "a non-Latin script"),
        ],
    )
    def test_a_real_name_is_accepted(self, value, why):
        """Every one of these is a real person's name. Anything stricter than
        'contains letters' starts refusing customers."""
        assert cv.check_name(value) is None, why


class TestStreet:
    @pytest.mark.parametrize("value", ["", "ab"])
    def test_an_empty_street_is_refused(self, value):
        assert cv.check_street(value) is not None

    @pytest.mark.parametrize(
        ("value", "why"),
        [
            ("Ashiana", "a house name with no number"),
            ("Near the post office", "a landmark address"),
            ("12/3 4th Cross, 5th Main", "an ordinary Bengaluru address"),
        ],
    )
    def test_an_address_without_a_house_number_is_still_an_address(self, value, why):
        """Requiring a digit would refuse rural and house-named deliveries
        outright. Those are flagged for review at most."""
        assert cv.check_street(value) is None, why


class TestSuspicions:
    def test_a_disposable_inbox_is_flagged_not_refused(self):
        assert cv.check_email("someone@mailinator.com") is None
        assert any("disposable" in s for s in cv.suspicions(email="someone@mailinator.com"))

    def test_a_house_name_with_no_number_is_mentioned_but_allowed(self):
        assert cv.check_street("Ashiana") is None
        assert any("house number" in s for s in cv.suspicions(street="Ashiana"))

    def test_a_real_address_raises_nothing(self):
        assert cv.suspicions(
            email="someone@gmail.com", street="12/3 4th Cross", city="Bengaluru"
        ) == []

    @pytest.mark.parametrize("value", ["asdfghjkl", "aaaaaa", "qwerty", "xyzpqrst"])
    def test_keyboard_input_is_recognised(self, value):
        assert cv.looks_like_gibberish(value) is True

    @pytest.mark.parametrize(
        "value", ["Bengaluru", "Koramangala", "Thiruvananthapuram", "Ashiana"]
    )
    def test_a_real_place_name_is_not(self, value):
        """The false-positive side. Flagging real place names would make the
        review queue useless, which is the same as not having one."""
        assert cv.looks_like_gibberish(value) is False
