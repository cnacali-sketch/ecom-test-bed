import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Coming soon",
};

// Shared placeholder for footer links (Track Order, FAQ, Privacy, etc.) that
// don't have real pages yet. Keeps them leading somewhere instead of "#".
export default function ComingSoonPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
      <p className="eyebrow flex items-center gap-3">
        <span aria-hidden className="h-px w-8 bg-gold" />
        Savvy In Teal
        <span aria-hidden className="h-px w-8 bg-gold" />
      </p>
      <h1 className="font-display mt-4 text-4xl italic text-teal sm:text-5xl">Coming soon</h1>
      <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-ink-soft">
        This page isn&apos;t ready yet. We&apos;re still putting it together —
        check back soon.
      </p>
      <Link
        href="/"
        className="mt-9 inline-block border border-teal px-8 py-3 text-xs uppercase tracking-[0.18em] text-teal transition-colors hover:bg-teal hover:text-white"
      >
        Back to shop
      </Link>
    </div>
  );
}
