import { describe, expect, test } from "vitest";

import { codSplit, isCodAvailable } from "./cod-split";

/**
 * These numbers go in front of a shopper who then presses "I agree", so the
 * cases that matter are the ones where a plausible-looking wrong answer would
 * still render as a tidy dialog.
 */

describe("codSplit", () => {
  test("an ordinary order pays the deposit now and the rest at the door", () => {
    expect(codSplit(1499, 200)).toEqual({
      depositNow: 200,
      balanceOnDelivery: 1299,
      total: 1499,
    });
  });

  test("the two halves always add back to the total", () => {
    /** The invariant the dialog is claiming. If these ever stop summing, the
     * shopper has agreed to a split that does not describe their order. */
    for (const total of [200, 249.5, 1499, 10000.01]) {
      const split = codSplit(total, 200);
      expect(split.depositNow + split.balanceOnDelivery).toBeCloseTo(split.total, 10);
    }
  });

  test("an order exactly equal to the deposit leaves nothing at the door", () => {
    expect(codSplit(200, 200)).toEqual({
      depositNow: 200,
      balanceOnDelivery: 0,
      total: 200,
    });
  });

  test("the deposit never exceeds the order, so no balance is ever negative", () => {
    /** COD is refused below the deposit, but a negative balance would read as
     * money owed BACK to the shopper -- never show that. */
    const split = codSplit(150, 200);

    expect(split.depositNow).toBe(150);
    expect(split.balanceOnDelivery).toBe(0);
  });

  test.each([
    ["NaN", Number.NaN],
    ["negative", -50],
  ])("a deposit that is %s collapses to zero rather than reaching the dialog", (_l, deposit) => {
    const split = codSplit(1499, deposit as number);

    expect(split.depositNow).toBe(0);
    expect(split.balanceOnDelivery).toBe(1499);
  });

  test("a NaN total does not become a NaN promise", () => {
    expect(codSplit(Number.NaN, 200)).toEqual({
      depositNow: 0,
      balanceOnDelivery: 0,
      total: 0,
    });
  });
});

describe("isCodAvailable", () => {
  test("an order above the deposit may use cash on delivery", () => {
    expect(isCodAvailable(1499, 200)).toBe(true);
  });

  test("an order exactly at the deposit is allowed, matching the server", () => {
    /** orders.py:367 refuses only `order_total < cod_deposit`. Disagreeing
     * here would offer COD the server rejects, or hide one it accepts. */
    expect(isCodAvailable(200, 200)).toBe(true);
  });

  test("an order below the deposit may not", () => {
    expect(isCodAvailable(199.99, 200)).toBe(false);
  });

  test("an unknown deposit does not silently enable cash on delivery", () => {
    expect(isCodAvailable(1499, Number.NaN)).toBe(false);
  });
});
