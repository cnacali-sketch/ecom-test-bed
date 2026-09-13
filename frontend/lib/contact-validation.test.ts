import { describe, expect, test } from "vitest";

import {
  emailProblem,
  looksLikeGibberish,
  nameProblem,
  normalisePhone,
  phoneProblem,
  postcodeProblem,
  streetProblem,
  suggestEmail,
  suspicions,
} from "./contact-validation";

/**
 * Checkout accepted an email of "@", a phone of "0000000000" and a postcode of
 * "x". The whole check was `email.includes("@")` and a digit count, and the
 * server checked nothing at all.
 *
 * Two risks pull in opposite directions here and both are represented below:
 * junk getting through, and a real customer being turned away. The second is
 * the dangerous one, because nobody reports it — they just leave.
 */

describe("phone", () => {
  test.each([
    ["+91 98765 43210", "with country code and spaces"],
    ["098765 43210", "with a trunk zero"],
    ["0091-98765-43210", "with a 0091 prefix"],
    ["9876543211", "bare"],
  ])("%s is read as ten digits (%s)", (input) => {
    expect(normalisePhone(input)).toHaveLength(10);
  });

  test.each([
    ["0000000000", "all the same digit"],
    ["1234567890", "counting up"],
    ["9876543210", "counting down"],
  ])("refuses %s (%s)", (value) => {
    expect(phoneProblem(value)).not.toBeNull();
  });

  test.each([["12345", "too short"], ["", "empty"], ["abcdefghij", "letters"]])(
    "refuses %s (%s)",
    (value) => {
      expect(phoneProblem(value)).not.toBeNull();
    },
  );

  test("a landline is refused, and told to use a mobile", () => {
    /** Deliberate. The courier rings this number before attempting delivery.
     * "Invalid phone" would leave someone staring at a number that works. */
    const problem = phoneProblem("011-23456789");

    expect(problem).toContain("mobile");
  });

  test.each([["6000000001"], ["7012345679"], ["8123456780"], ["9812345671"]])(
    "%s is accepted",
    (value) => {
      expect(phoneProblem(value)).toBeNull();
    },
  );
});

describe("email", () => {
  test.each([
    ["@", "the one checkout used to accept"],
    ["a@b", "no TLD"],
    ["no-at-sign.com", "no @"],
    ["two@@at.com", "doubled @"],
    ["trailing@dot.", "trailing dot"],
    ["", "empty"],
  ])("refuses %s (%s)", (value) => {
    expect(emailProblem(value)).not.toBeNull();
  });

  test.each([
    ["someone@gmail.com"],
    ["first.last+tag@sub.domain.co.in"],
    ["a_b-c@example.org"],
  ])("%s is accepted", (value) => {
    expect(emailProblem(value)).toBeNull();
  });

  test("a likely typo is offered as a correction, not a refusal", () => {
    /** gmial.com is a real domain somebody could be at. Refusing it would be
     * us being confidently wrong about someone's own address. */
    expect(emailProblem("someone@gmial.com")).toBeNull();
    expect(suggestEmail("someone@gmial.com")).toBe("someone@gmail.com");
  });

  test("an address that is already right is not corrected", () => {
    expect(suggestEmail("someone@gmail.com")).toBeNull();
  });
});

describe("postcode", () => {
  test.each([["x"], ["1234"], ["1234567"], ["abcdef"], [""]])("refuses %s", (value) => {
    expect(postcodeProblem(value)).not.toBeNull();
  });

  test.each([["000000", "leading 0"], ["999999", "leading 9"]])(
    "refuses %s (%s — no real Indian PIN starts with it)",
    (value) => {
      /** Measured across all 19,238 postcodes in the bundled dataset: the
       * first digit is only ever 1-8. A length-only check passes both. */
      expect(postcodeProblem(value)).not.toBeNull();
    },
  );

  test.each([["560025"], ["110001"], ["682001"], ["797001"]])("%s is accepted", (value) => {
    expect(postcodeProblem(value)).toBeNull();
  });
});

describe("name", () => {
  test.each([["a", "one character"], ["", "empty"], ["1234", "digits only"], ["aaaa", "one letter repeated"]])(
    "refuses %s (%s)",
    (value) => {
      expect(nameProblem(value)).not.toBeNull();
    },
  );

  test.each([
    ["Ravi", "a mononym"],
    ["R K Narayan", "initials"],
    ["D'Souza", "an apostrophe"],
    ["ಸವ್ಯ", "a non-Latin script"],
  ])("accepts %s (%s)", (value) => {
    /** Every one of these is a real person's name. Anything stricter than
     * "contains letters" starts refusing customers. */
    expect(nameProblem(value)).toBeNull();
  });
});

describe("street", () => {
  test.each([["", "empty"], ["ab", "two characters"]])("refuses %s (%s)", (value) => {
    expect(streetProblem(value)).not.toBeNull();
  });

  test.each([
    ["Ashiana", "a house name with no number"],
    ["Near the post office", "a landmark address"],
    ["12/3 4th Cross, 5th Main", "an ordinary Bengaluru address"],
  ])("accepts %s (%s)", (value) => {
    /** Requiring a house number would refuse rural and house-named addresses
     * outright. These are flagged for review at most. */
    expect(streetProblem(value)).toBeNull();
  });
});

describe("suspicions", () => {
  test("a disposable inbox is flagged, not refused", () => {
    expect(emailProblem("someone@mailinator.com")).toBeNull();
    expect(suspicions({ email: "someone@mailinator.com" })).toContainEqual(
      expect.stringContaining("disposable"),
    );
  });

  test("a house name with no number is mentioned but allowed", () => {
    expect(streetProblem("Ashiana")).toBeNull();
    expect(suspicions({ street: "Ashiana" })).toContainEqual(
      expect.stringContaining("no house number"),
    );
  });

  test("a real address raises nothing", () => {
    expect(
      suspicions({ email: "someone@gmail.com", street: "12/3 4th Cross", city: "Bengaluru" }),
    ).toEqual([]);
  });

  test.each([["asdfghjkl"], ["aaaaaa"], ["qwerty"], ["xyzpqrst"]])(
    "%s reads as keyboard input",
    (value) => {
      expect(looksLikeGibberish(value)).toBe(true);
    },
  );

  test.each([["Bengaluru"], ["Koramangala"], ["Thiruvananthapuram"], ["Ashiana"]])(
    "%s does not",
    (value) => {
      /** The false-positive side. Flagging real place names would make the
       * review queue useless, which is the same as not having one. */
      expect(looksLikeGibberish(value)).toBe(false);
    },
  );
});
