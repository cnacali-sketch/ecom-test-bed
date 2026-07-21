"use client";

// Real checkout. Cash on Delivery places a live order today; online payment
// is shown but disabled — the gateway (Razorpay) isn't wired yet.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AddressFields, seedAddress } from "@/components/ui/AddressFields";
import { trackEvent } from "@/lib/analytics";
import { apiFetch } from "@/lib/api-client";
import { useAuth, type Address } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
import { formatPrice } from "@/lib/format";

export default function CheckoutPage() {
  const { items, subtotal, clearCart } = useCart();
  const { user } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState(user?.email ?? "");
  const [address, setAddress] = useState<Address>(seedAddress(user?.postal_address));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    trackEvent("checkout_started");
  }, []);

  if (items.length === 0) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
        <h1 className="font-display text-3xl italic text-ink">Your cart is empty</h1>
        <p className="mt-3 text-sm text-ink-soft">Add something you love, then come back to check out.</p>
        <Link
          href="/"
          className="mt-8 inline-block border border-teal px-8 py-3 text-xs uppercase tracking-[0.18em] text-teal transition-colors hover:bg-teal hover:text-white"
        >
          Continue shopping
        </Link>
      </div>
    );
  }

  async function handlePlaceOrder(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!user && !email.includes("@")) {
      setError("Enter a valid email so we can send your order confirmation.");
      return;
    }
    if (!address.line1 || !address.city || !address.postcode) {
      setError("Fill in at least address line 1, city, and postcode.");
      return;
    }

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
          payment_method: "cod",
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
      trackEvent("order_placed");
      clearCart();
      router.push(`/track-order?order_id=${order.id}&placed=1`);
    } catch {
      setError("Cannot reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl italic text-ink">Checkout</h1>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_320px]">
        <form onSubmit={handlePlaceOrder} className="space-y-8">
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
                  className="mt-1 w-full border border-ink/15 bg-card px-3 py-2 text-ink outline-none focus:border-teal"
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
            <label className="flex items-center gap-3 border border-teal bg-teal/5 px-4 py-3">
              <input type="radio" checked readOnly className="h-4 w-4 accent-teal" />
              <span className="text-sm font-medium text-ink">Cash on Delivery</span>
            </label>
            <div className="flex items-center gap-3 border border-ink/10 px-4 py-3 opacity-60">
              <input type="radio" disabled className="h-4 w-4" />
              <span className="text-sm text-ink-soft">Pay online (UPI / card) — coming soon</span>
            </div>
          </section>

          {error && (
            <p role="alert" className="border-l-2 border-sale bg-sale/5 px-3 py-2 text-sm text-sale">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-teal py-3.5 text-xs uppercase tracking-[0.2em] text-white transition-colors hover:bg-teal-deep disabled:opacity-60 sm:w-auto sm:px-10"
          >
            {submitting ? "Placing order…" : "Place order (Cash on Delivery)"}
          </button>
        </form>

        <aside className="h-fit border border-ink/10 bg-card p-5">
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
          <div className="mt-4 flex justify-between border-t border-ink/10 pt-4 text-sm font-semibold text-ink">
            <span>Subtotal</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
