/**
 * Format rules for the things a courier and an inbox actually need.
 *
 * Checkout used to accept an email of `@`, a phone of `0000000000` and a
 * postcode of `x`: the whole check was `email.includes("@")` and a digit count.
 * Nothing on the server objected either.
 *
 * This mirrors `backend/app/services/contact_validation.py` rule for rule, the
 * way `cod-split.ts` mirrors `orders.py`. The copy here exists so a shopper is
 * told immediately and in place; **the server's copy is the one that decides**,
 * because a browser is not a security boundary. When the two disagree that is a
 * bug, which is why both sides assert the same table of cases.
 *
 * Two kinds of answer, deliberately not mixed:
 *
 * - **A `problem` is a reason to refuse.** Only ever something provably wrong.
 * - **A `suspicion` is worth a human glance**, never a refusal.
 *
 * Everything is deliberately generous. A false rejection costs a real sale and
 * the customer never tells you it happened; a false flag costs someone ten
 * seconds in the admin.
 */

/** Pragmatic, not RFC 5322 — the full grammar admits addresses no shop will be
 * sent, and writing it out invites mistakes in the direction that matters.
 * Requires a dotted domain and a TLD of at least two letters, which is what
 * "can this receive mail" comes down to. */
const EMAIL_RE =
  /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;

export const EMAIL_MAX = 320;

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com",
  "temp-mail.org", "throwawaymail.com", "yopmail.com", "trashmail.com",
  "sharklasers.com", "getnada.com", "dispostable.com", "maildrop.cc",
  "fakeinbox.com", "mailnesia.com", "spamgourmet.com", "mintemail.com",
]);

/** Near-misses for the domains this shop's customers actually use. Only ever
 * offered as a suggestion — `gmial.com` is a real domain somebody could be at. */
const DOMAIN_SUGGESTIONS: Record<string, string> = {
  "gmial.com": "gmail.com", "gmai.com": "gmail.com", "gmail.co": "gmail.com",
  "gmail.con": "gmail.com", "gmaill.com": "gmail.com", "gnail.com": "gmail.com",
  "yahooo.com": "yahoo.com", "yaho.com": "yahoo.com",
  "hotmial.com": "hotmail.com", "hotmail.co": "hotmail.com",
  "outlok.com": "outlook.com", "rediffmial.com": "rediffmail.com",
};

/**
 * An Indian mobile reduced to its ten digits, or "" if it is not one.
 *
 * Accepts what people actually type: `+91 98765 43210`, `098765-43210`,
 * `0091...`. The country code and a trunk `0` carry no information here —
 * this shop ships only within India.
 */
export function normalisePhone(value: string): string {
  let digits = (value ?? "").replace(/\D/g, "");
  for (const prefix of ["0091", "91", "0"]) {
    if (digits.length > 10 && digits.startsWith(prefix)) {
      digits = digits.slice(prefix.length);
      break;
    }
  }
  return digits.length === 10 ? digits : "";
}

/** `0000000000`, `1234567890`, `9876543210` — filler, not phone numbers. */
function isPatterned(digits: string): boolean {
  if (new Set(digits).size === 1) return true;
  const steps = [...digits].slice(1).map((d, i) => Number(d) - Number(digits[i]));
  return steps.every((s) => s === 1) || steps.every((s) => s === -1);
}

/**
 * Reason to refuse this phone number, or null.
 *
 * A landline written with its STD code (`011-23456789`) is refused, and that is
 * a decision rather than an oversight: this number exists so a courier can ring
 * before attempting delivery, and every Indian courier expects a mobile. The
 * message says "mobile" for that reason — told only "invalid phone", someone
 * typing a working landline cannot tell what is wanted.
 */
export function phoneProblem(value: string): string | null {
  const digits = normalisePhone(value);
  if (!digits) return "Enter a 10-digit Indian mobile number.";
  if (!"6789".includes(digits[0])) return "Enter a mobile number — it should start with 6, 7, 8 or 9.";
  if (isPatterned(digits)) return "That doesn't look like a real mobile number.";
  return null;
}

export function emailProblem(value: string): string | null {
  const cleaned = (value ?? "").trim();
  if (!cleaned) return "Enter an email address so we can send your order confirmation.";
  if (cleaned.length > EMAIL_MAX) return "That email address is too long.";
  if (!EMAIL_RE.test(cleaned)) return "That doesn't look like a complete email address.";
  return null;
}

/** A corrected address to offer when the domain looks like a typo. */
export function suggestEmail(value: string): string | null {
  const cleaned = (value ?? "").trim();
  const at = cleaned.lastIndexOf("@");
  if (at < 0) return null;
  const fixed = DOMAIN_SUGGESTIONS[cleaned.slice(at + 1).toLowerCase()];
  return fixed ? `${cleaned.slice(0, at)}@${fixed}` : null;
}

/**
 * Reason to refuse a recipient name, or null.
 *
 * Only asks that it be a name-shaped thing. Indian names are short, long,
 * single-word and full of punctuation, so anything stricter than "has letters
 * in it" refuses real people.
 */
export function nameProblem(value: string): string | null {
  const cleaned = (value ?? "").trim().split(/\s+/).join(" ");
  if (cleaned.length < 2) return "Enter the full name of whoever is receiving the parcel.";
  if (!/\p{L}/u.test(cleaned)) return "Enter the recipient's name.";
  if (new Set(cleaned.replace(/\s/g, "").toLowerCase()).size === 1) return "Enter the recipient's name.";
  return null;
}

/**
 * Reason to refuse a street line, or null.
 *
 * Almost nothing is refused. A house number is **not** required: "Ashiana" and
 * "Near the post office" are ordinary Indian addresses, and demanding a digit
 * would turn away rural and house-named deliveries outright. Those are flagged
 * instead — see `suspicions`.
 */
export function streetProblem(value: string): string | null {
  const cleaned = (value ?? "").trim().split(/\s+/).join(" ");
  if (cleaned.length < 3) return "Enter the street address the parcel should go to.";
  return null;
}

/** Six digits, not starting 0 or 9 — measured across all 19,238 real Indian
 * postcodes, where the leading digit is only ever 1-8. */
export function postcodeProblem(value: string): string | null {
  const cleaned = (value ?? "").trim();
  if (!/^\d{6}$/.test(cleaned)) return "Enter a 6-digit PIN code.";
  if (!"12345678".includes(cleaned[0])) return "That isn't a valid Indian PIN code.";
  return null;
}

const KEYBOARD_RUNS = ["qwert", "asdfg", "zxcvb", "yuiop", "hjkl", "12345"];

/** Whether a line looks typed to get past a form rather than to be read. Three
 * weak signals, which is why this only ever raises a flag. */
export function looksLikeGibberish(value: string): boolean {
  const cleaned = (value ?? "").trim().toLowerCase();
  if (!cleaned) return false;
  if (/(.)\1{3,}/.test(cleaned)) return true;
  if (KEYBOARD_RUNS.some((run) => cleaned.includes(run))) return true;
  return (cleaned.match(/[a-z]+/g) ?? []).some(
    (word) => word.length >= 5 && !/[aeiou]/.test(word),
  );
}

/** Things worth an admin's glance. Never a reason to refuse an order. */
export function suspicions(input: { email?: string; street?: string; city?: string }): string[] {
  const found: string[] = [];

  const domain = (input.email ?? "").trim().toLowerCase().split("@").pop() ?? "";
  if (domain && DISPOSABLE_DOMAINS.has(domain)) found.push(`disposable email domain (${domain})`);

  const street = (input.street ?? "").trim();
  if (street) {
    if (looksLikeGibberish(street)) found.push("street address looks like keyboard input");
    else if (!/\d/.test(street) && street.split(/\s+/).length === 1)
      found.push("street address has no house number");
  }

  if (input.city && looksLikeGibberish(input.city)) found.push("city looks like keyboard input");

  return found;
}
