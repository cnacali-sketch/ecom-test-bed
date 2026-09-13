/**
 * Whether a freshly-created order still owes money online.
 *
 * This exists because the checkout page and the backend each answered that
 * question separately, and disagreed. The page asked
 * `POST /api/orders/{id}/razorpay/init` for every order it created; the
 * endpoint refuses a Cash-on-Delivery order that has no deposit due
 * (`backend/app/routers/orders.py:1292`). An admin placing a COD order is
 * given no deposit on purpose -- that branch is for phone and manual entry,
 * which has no checkout behind it (`orders.py:366`) -- so the order was
 * written, then stranded behind "Could not start payment" with no way forward.
 *
 * Keeping the rule in one named place is the point. The backend stays
 * authoritative about money: nothing here marks anything paid, and
 * `/razorpay/verify` still demands a real signature. This only decides whether
 * it is worth opening the modal at all.
 */

/** The fields of `OrderRead` this decision reads. Narrow on purpose -- it
 * documents the real input, and a caller holding a fuller order still fits. */
export type PayableOrder = {
  payment_method: string;
  payment_status?: string;
  deposit_amount?: number | string | null;
  deposit_paid?: boolean;
};

/**
 * Mirrors the server's own branch in `init_razorpay_payment`:
 *
 * - **prepaid** owes the full total, unless it is already paid.
 * - **COD** owes its confirmation deposit, unless that deposit is already
 *   collected or no deposit was ever charged (an admin-placed order).
 * - **anything else** is not an online order at all.
 *
 * `deposit_amount` arrives as a JSON string from a `Decimal` column, so it is
 * coerced rather than compared directly -- `"0.00" > 0` is false but
 * `"200.00" > 0` is also false, and that silent lie is the whole bug class
 * this guards.
 */
export function requiresOnlinePayment(order: PayableOrder): boolean {
  if (order.payment_method === "prepaid") {
    return order.payment_status !== "paid";
  }

  if (order.payment_method === "cod") {
    if (order.deposit_paid) return false;
    const deposit = Number(order.deposit_amount);
    return Number.isFinite(deposit) && deposit > 0;
  }

  return false;
}
