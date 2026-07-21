import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Checkout — coming soon",
};

// Placeholder until the payment gateway (Razorpay) is wired. Keeps the cart
// CTA leading somewhere real instead of a dead button.
export default function CheckoutPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
      <p className="eyebrow flex items-center gap-3">
        <span aria-hidden className="h-px w-8 bg-gold" />
        Checkout
        <span aria-hidden className="h-px w-8 bg-gold" />
      </p>
      <h1 className="font-display mt-4 text-4xl italic text-teal sm:text-5xl">Coming soon</h1>
      <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-ink-soft">
        Online payments aren&apos;t live yet. Your cart is saved — come back shortly
        and you&apos;ll be able to check out securely.
      </p>
      <Link
        href="/"
        className="mt-9 inline-block border border-teal px-8 py-3 text-xs uppercase tracking-[0.18em] text-teal transition-colors hover:bg-teal hover:text-white"
      >
        Continue shopping
      </Link>
    </div>
  );
}
