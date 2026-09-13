/**
 * How a Cash-on-Delivery order divides into "now" and "at the door".
 *
 * The confirmation dialog states both numbers and the shopper agrees to them,
 * so this is a representation about money rather than a label. It is kept
 * apart from the dialog for that reason: the arithmetic can be tested against
 * the awkward cases directly, instead of only through a rendered component
 * where a wrong number looks like correct markup.
 *
 * The deposit comes from `GET /api/checkout/terms` -- the server's own value,
 * not a constant kept in step by hand.
 */

export type CodSplit = {
  /** Charged online now, via Razorpay. Non-refundable once collected. */
  depositNow: number;
  /** Handed to the courier on delivery. */
  balanceOnDelivery: number;
  /** What the two add up to, restated so the dialog cannot drift from it. */
  total: number;
};

/**
 * Split `total` into the deposit taken now and the balance owed on delivery.
 *
 * Two rules, both of them about never overstating what someone owes:
 *
 * **The deposit never exceeds the total.** An order at or below the deposit
 * cannot use COD at all (the server refuses it with a 422), but if that guard
 * is ever reordered or relaxed, the arithmetic here must not produce a
 * negative balance that reads to a shopper as money coming back.
 *
 * **Neither half goes negative.** A malformed or absent deposit collapses to
 * zero rather than propagating `NaN` into a dialog someone is agreeing to --
 * "₹NaN due on delivery" is worse than a wrong number, because it is not even
 * a claim that can be checked.
 */
export function codSplit(total: number, depositAmount: number): CodSplit {
  const safeTotal = Number.isFinite(total) && total > 0 ? total : 0;
  const requested = Number.isFinite(depositAmount) && depositAmount > 0 ? depositAmount : 0;
  const depositNow = Math.min(requested, safeTotal);

  return {
    depositNow,
    balanceOnDelivery: safeTotal - depositNow,
    total: safeTotal,
  };
}

/**
 * Whether Cash on Delivery may be offered for this basket at all.
 *
 * Mirrors the server's own guard (`orders.py:367`): an order worth less than
 * the deposit would be paying its whole value up front to confirm itself, so
 * it must be paid online in full instead. Strictly below -- an order exactly
 * equal to the deposit is allowed, and settles with nothing owed at the door,
 * which is what the server does too.
 */
export function isCodAvailable(total: number, depositAmount: number): boolean {
  if (!Number.isFinite(total) || !Number.isFinite(depositAmount)) return false;
  return total >= depositAmount;
}
