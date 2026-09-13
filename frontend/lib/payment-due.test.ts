import { describe, expect, test } from "vitest";

import { requiresOnlinePayment } from "./payment-due";

/**
 * Every case here is a real order shape the checkout page has produced. The
 * one that matters is the admin COD order: it was created on the live shop,
 * saved, and then stranded, because this decision was made by asking an
 * endpoint that refuses it rather than by reading the order.
 */

describe("cash on delivery", () => {
  test("a shopper's COD order owes its deposit", () => {
    expect(
      requiresOnlinePayment({ payment_method: "cod", deposit_amount: "200.00", deposit_paid: false }),
    ).toBe(true);
  });

  test("an admin-placed COD order owes nothing, so no modal is opened", () => {
    /** The live bug. An admin gets no deposit by design, /razorpay/init then
     * answers 400, and the old code surfaced that as "Could not start payment"
     * on an order that was already saved and already confirmed by email. */
    expect(
      requiresOnlinePayment({ payment_method: "cod", deposit_amount: "0.00", deposit_paid: false }),
    ).toBe(false);
  });

  test("a deposit already collected is not collected twice", () => {
    expect(
      requiresOnlinePayment({ payment_method: "cod", deposit_amount: "200.00", deposit_paid: true }),
    ).toBe(false);
  });

  test.each([
    ["absent", undefined],
    ["null", null],
    ["not a number", "abc"],
  ])("a deposit that is %s is treated as nothing due, not as a charge", (_label, value) => {
    /** Failing open here would open a Razorpay modal for NaN paise. */
    expect(requiresOnlinePayment({ payment_method: "cod", deposit_amount: value })).toBe(false);
  });
});

describe("prepaid", () => {
  test("an unpaid prepaid order owes the full total", () => {
    expect(requiresOnlinePayment({ payment_method: "prepaid", payment_status: "unpaid" })).toBe(true);
  });

  test("a paid prepaid order is not charged again", () => {
    expect(requiresOnlinePayment({ payment_method: "prepaid", payment_status: "paid" })).toBe(false);
  });

  test("a prepaid order says nothing about its deposit and is still charged", () => {
    /** Guards against reading deposit_amount on the prepaid branch, which
     * would make every prepaid order look settled. */
    expect(
      requiresOnlinePayment({ payment_method: "prepaid", payment_status: "unpaid", deposit_amount: "0.00" }),
    ).toBe(true);
  });
});

test("an unknown payment method is never sent to the gateway", () => {
  expect(requiresOnlinePayment({ payment_method: "invoice" })).toBe(false);
});
