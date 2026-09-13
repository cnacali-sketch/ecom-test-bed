"use client";

// Real checkout. Cash on Delivery places a live order today; online payment
// is shown but disabled — the gateway (Razorpay) isn't wired yet.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { CodConfirmDialog } from "@/components/checkout/CodConfirmDialog";
import { AddressFields, seedAddress } from "@/components/ui/AddressFields";
import { useSiteContent } from "@/lib/site-content-context";
import { trackEvent } from "@/lib/analytics";
import { apiFetch } from "@/lib/api-client";
import { useAuth, type Address } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
import { codSplit, isCodAvailable } from "@/lib/cod-split";
import { formatPrice } from "@/lib/format";
import { requiresOnlinePayment } from "@/lib/payment-due";
import { openRazorpayCheckout } from "@/lib/razorpay";

export default function CheckoutPage() {
  // Same reason as the contact page: importing the config directly ships
  // all of it to the browser. Read here rather than in the handler below,
  // because a hook cannot be called from inside an event callback.
  const { brand, policies, checkout } = useSiteContent();
  const { items, subtotal, clearCart } = useCart();
  const { user } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState(user?.email ?? "");
  // Seeded from the saved address, falling back to the account holder's own
  // name — a signed-in shopper shipping to themselves should not have to
  // retype what the profile already knows.
  const [address, setAddress] = useState<Address>(() => {
    const seeded = seedAddress(user?.postal_address);
    return seeded.full_name ? seeded : { ...seeded, full_name: user?.full_name ?? "" };
  });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "prepaid">("cod");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [couponCode, setCouponCode] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);
  const total = subtotal - (appliedCoupon?.discount ?? 0);

  // The Cash-on-Delivery deposit comes from the server. It used to be a
  // constant here with a comment asking whoever changed the backend to change
  // it here too — survivable for a label, not for a dialog the shopper agrees
  // to, which states what they are about to be charged.
  //
  // Null means "not answered yet". COD is not offered until it is known,
  // rather than offered against a guessed amount.
  const [codDeposit, setCodDeposit] = useState<number | null>(null);
  const [showCodDialog, setShowCodDialog] = useState(false);
  const codAvailable = codDeposit !== null && isCodAvailable(total, codDeposit);

  useEffect(() => {
    trackEvent("checkout_started");
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await apiFetch("/api/checkout/terms");
      if (!res?.ok || cancelled) return;
      const terms = await res.json();
      if (!cancelled) setCodDeposit(Number(terms.cod_deposit_amount));
    })().catch(() => {
      // Leaves codDeposit null, which hides COD rather than offering it at an
      // amount we could not confirm. Online payment still works.
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (items.length === 0) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
        <h1 className="font-display text-3xl italic text-ink">Your cart is empty</h1>
        <p className="mt-3 text-sm text-ink-soft">Add something you love, then come back to check out.</p>
        <Link
          href="/"
          className="mt-8 inline-block rounded-full border border-teal px-8 py-3 text-xs uppercase tracking-[0.18em] text-teal transition-colors hover:bg-teal hover:text-white"
        >
          Continue shopping
        </Link>
      </div>
    );
  }

  async function handleApplyCoupon() {
    const code = couponCode.trim();
    if (!code) return;
    setCheckingCoupon(true);
    setCouponError(null);
    try {
      const res = await apiFetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, subtotal }),
      });
      if (!res?.ok) {
        const body = await res?.json().catch(() => null);
        setCouponError(body?.detail ?? "Could not apply that code.");
        setAppliedCoupon(null);
        return;
      }
      const data = await res.json();
      setAppliedCoupon({ code: data.code, discount: Number(data.discount_amount) });
    } catch {
      setCouponError("Could not reach the server. Please try again.");
    } finally {
      setCheckingCoupon(false);
    }
  }

  /**
   * Validate, then decide whether anything still has to be agreed to.
   *
   * A COD order is not placed straight from the button: the shopper is shown
   * the split first and has to accept it. Validation runs before the dialog so
   * they are not asked to agree to a purchase that a missing postcode is about
   * to reject anyway.
   */
  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!validate()) return;

    if (paymentMethod === "cod" && codAvailable) {
      setShowCodDialog(true);
      return;
    }
    void placeOrder();
  }

  /** Everything checkout refuses to proceed without. Returns false having set
   * the message, so the caller reads as a guard rather than a branch. */
  function validate(): boolean {
    if (!user && !email.includes("@")) {
      setError("Enter a valid email so we can send your order confirmation.");
      return false;
    }
    // The consignee name goes on the waybill — Delhivery, Shiprocket and
    // Bluedart all reject a shipment without one, so an order placed without
    // it cannot actually be dispatched.
    if ((address.full_name ?? "").trim().length < 2) {
      setError("Enter the full name of whoever is receiving the parcel.");
      return false;
    }
    if (!address.line1 || !address.city || !address.postcode) {
      setError("Fill in at least address line 1, city, and postcode.");
      return false;
    }
    // Couriers call before attempting delivery, so this is not optional.
    if ((address.phone ?? "").replace(/\D/g, "").length < 10) {
      setError("Enter a phone number the courier can reach you on.");
      return false;
    }
    if (!termsAccepted) {
      setError("Please accept the Terms & Conditions to place your order.");
      return false;
    }
    return true;
  }

  /** Create the order and, when something is owed online, collect it. */
  async function placeOrder() {
    setSubmitting(true);
    try {
      const response = await apiFetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user?.email ?? email,
          items: items.map((item) => ({
            product_id: item.productId,
            quantity: item.quantity,
            unit_price: item.price,
          })),
          shipping_address: address,
          // Orders under the COD deposit amount can't use COD — force prepaid.
          payment_method: paymentMethod === "cod" && !codAvailable ? "prepaid" : paymentMethod,
          terms_accepted: termsAccepted,
          terms_version: policies.termsVersion,
          coupon_code: appliedCoupon?.code,
        }),
      });

      if (!response) {
        setError("Cannot reach the server. Please try again.");
        return;
      }
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.detail ?? "Could not place your order. Please try again.");
        return;
      }
      const order = await response.json();

      // An admin placing a COD order is deliberately given no deposit, and the
      // backend already confirmed that order — email included — when it was
      // created. Asking /razorpay/init for it anyway earns a 400 and strands a
      // saved order behind "Could not start payment". See lib/payment-due.ts.
      if (!requiresOnlinePayment(order)) {
        trackEvent("order_placed");
        clearCart();
        router.push(`/track-order?order_id=${order.id}&placed=1`);
        return;
      }

      // Collect payment via Razorpay. Prepaid pays the full total; Cash on
      // Delivery pays its non-refundable confirmation deposit now, with the
      // balance paid on delivery. The backend decides the amount via
      // /razorpay/init.
      const init = await apiFetch(`/api/orders/${order.id}/razorpay/init`, {
        method: "POST",
      });
      if (!init?.ok) {
        const initBody = await init?.json().catch(() => null);
        setError(
          initBody?.detail ??
            "Could not start payment. Your order is saved as pending — you can try again.",
        );
        return;
      }
      const rzp = await init.json();

      try {
        const result = await openRazorpayCheckout({
          keyId: rzp.key_id,
          orderId: rzp.razorpay_order_id,
          amount: rzp.amount,
          currency: rzp.currency ?? "INR",
          name: brand.name,
          description: `${items.length} item${items.length > 1 ? "s" : ""} from ${brand.name}`,
          prefill: {
            email: user?.email ?? email,
            contact: address.phone,
          },
          notes: { order_id: String(order.id) },
        });

        const verify = await apiFetch(`/api/orders/${order.id}/razorpay/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            razorpay_order_id: result.razorpay_order_id,
            razorpay_payment_id: result.razorpay_payment_id,
            razorpay_signature: result.razorpay_signature ?? "",
          }),
        });
        if (!verify?.ok) {
          setError(
            "Your payment succeeded but we couldn't confirm it yet. Your order is saved — if it isn't confirmed shortly, contact us.",
          );
          return;
        }
        trackEvent("order_placed");
        clearCart();
        router.push(`/track-order?order_id=${order.id}&placed=1`);
      } catch {
        setError("Payment was not completed. Your order is saved as pending — you can try again.");
      }
    } catch {
      setError("Cannot reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl italic text-ink">Checkout</h1>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_340px]">
        <form onSubmit={handleSubmit} className="space-y-9">
          {!user && (
            <section className="space-y-4">
              <h2 className="font-display text-xl italic text-ink">Your email</h2>
              <label className="block max-w-sm">
                <span className="block text-xs uppercase tracking-wide text-ink-soft">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="mt-1.5 w-full rounded-xl border border-rule-soft bg-card px-3.5 py-2.5 text-ink outline-none focus:border-teal"
                />
              </label>
              <p className="text-xs text-ink-soft">
                We&apos;ll email your order confirmation and tracking here.
              </p>
            </section>
          )}

          <AddressFields heading="Delivery address" value={address} onChange={setAddress} prefix="shipping" />

          <section className="space-y-3">
            <h2 className="font-display text-xl italic text-ink">Payment</h2>
            <label
              className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3.5 transition-colors ${
                !codAvailable
                  ? "cursor-not-allowed opacity-50"
                  : paymentMethod === "cod"
                    ? "border-teal bg-teal/5"
                    : "border-rule-soft"
              }`}
            >
              <input
                type="radio"
                name="payment"
                value="cod"
                checked={paymentMethod === "cod"}
                disabled={!codAvailable}
                onChange={() => setPaymentMethod("cod")}
                className="h-4 w-4 accent-teal"
              />
              <span>
                <span className="block text-sm font-medium text-ink">Cash on Delivery</span>
                <span className="block text-xs text-ink-soft">
                  {codDeposit === null
                    ? "Confirmed with a small deposit paid online · balance on delivery"
                    : `Pay a non-refundable ${formatPrice(codDeposit)} deposit online to confirm · balance on delivery`}
                </span>
              </span>
            </label>
            <label
              className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3.5 transition-colors ${
                paymentMethod === "prepaid" ? "border-teal bg-teal/5" : "border-rule-soft"
              }`}
            >
              <input
                type="radio"
                name="payment"
                value="prepaid"
                checked={paymentMethod === "prepaid"}
                onChange={() => setPaymentMethod("prepaid")}
                className="h-4 w-4 accent-teal"
              />
              <span className="text-sm font-medium text-ink">
                Pay online (UPI / card / net-banking)
              </span>
            </label>
            {!codAvailable && (
              <p className="text-xs text-sale">
                {codDeposit === null
                  ? "Cash on Delivery is unavailable right now — please pay online instead."
                  : `Cash on Delivery needs an order of ${formatPrice(codDeposit)}+ — please pay online instead.`}
              </p>
            )}
            {paymentMethod === "cod" && codAvailable && (
              <p className="text-xs text-ink-soft">
                Non-refundable {formatPrice(codSplit(total, codDeposit ?? 0).depositNow)} collected now ·{" "}
                {formatPrice(codSplit(total, codDeposit ?? 0).balanceOnDelivery)} balance on delivery
              </p>
            )}
          </section>

          <label className="flex items-start gap-3 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              required
              className="mt-0.5 h-4 w-4 accent-teal"
            />
            <span>
              I have read and agree to the{" "}
              <Link href="/policies/terms" target="_blank" className="text-teal underline">
                Terms &amp; Conditions
              </Link>
              .
            </span>
          </label>

          {error && (
            <p role="alert" className="rounded-lg border-l-2 border-sale bg-sale/5 px-3 py-2 text-sm text-sale">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || !termsAccepted}
            className="w-full rounded-full bg-teal py-3.5 text-xs uppercase tracking-[0.2em] text-white transition-colors hover:bg-teal-deep disabled:opacity-60 sm:w-auto sm:px-10"
          >
            {submitting
              ? "Processing…"
              : paymentMethod === "cod"
                ? "Place order (Cash on Delivery)"
                : `Pay ${formatPrice(total)} online`}
          </button>
        </form>

        <CodConfirmDialog
          open={showCodDialog}
          total={total}
          depositAmount={codDeposit ?? 0}
          copy={checkout.codDialog}
          onCancel={() => setShowCodDialog(false)}
          onAgree={() => {
            // Closed before placing, not after: the order can take a while and
            // leaving the dialog up would invite a second agreement — which is
            // a second order — while the first is still in flight.
            setShowCodDialog(false);
            void placeOrder();
          }}
        />

        <aside className="h-fit rounded-[28px] border border-rule-soft bg-card p-6">
          <h2 className="font-display text-lg italic text-ink">Order summary</h2>
          <ul className="mt-4 space-y-3">
            {items.map((item) => (
              <li key={item.variantId} className="flex justify-between gap-3 text-sm">
                <span className="text-ink-soft">
                  {item.name}
                  {item.color ? ` · ${item.color}` : ""} × {item.quantity}
                </span>
                <span className="shrink-0 font-medium text-ink">
                  {formatPrice(item.price * item.quantity, item.currency)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-5 border-t border-rule-soft pt-4">
            <label className="block text-xs uppercase tracking-wide text-ink-soft">Coupon code</label>
            <div className="mt-1.5 flex gap-2">
              <input
                value={couponCode}
                onChange={(e) => {
                  setCouponCode(e.target.value);
                  setAppliedCoupon(null);
                  setCouponError(null);
                }}
                placeholder="Enter code"
                className="w-full rounded-xl border border-rule-soft bg-card px-3.5 py-2.5 text-sm text-ink outline-none focus:border-teal"
              />
              <button
                type="button"
                onClick={handleApplyCoupon}
                disabled={checkingCoupon || !couponCode.trim()}
                className="shrink-0 rounded-full border border-teal px-4 py-2 text-xs uppercase tracking-wide text-teal hover:bg-teal hover:text-white disabled:opacity-50"
              >
                {checkingCoupon ? "Checking…" : "Apply"}
              </button>
            </div>
            {couponError && <p className="mt-1.5 text-xs text-sale">{couponError}</p>}
            {appliedCoupon && (
              <p className="mt-1.5 text-xs text-teal">
                &ldquo;{appliedCoupon.code}&rdquo; applied — -{formatPrice(appliedCoupon.discount)}
              </p>
            )}
          </div>

          <div className="mt-4 flex justify-between border-t border-rule-soft pt-4 text-sm text-ink">
            <span>Subtotal</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          {appliedCoupon && (
            <div className="mt-1 flex justify-between text-sm text-teal">
              <span>Discount</span>
              <span>-{formatPrice(appliedCoupon.discount)}</span>
            </div>
          )}
          <div className="mt-1 flex justify-between text-sm font-semibold text-ink">
            <span>Total</span>
            <span>{formatPrice(total)}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
