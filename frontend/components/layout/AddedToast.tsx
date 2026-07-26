"use client";

import { useEffect } from "react";
import { useCart } from "@/lib/cart-context";

const AUTO_DISMISS_MS = 15000;

/**
 * Mobile-only "Added!" toast — a brief cart-silhouette confirmation instead
 * of opening the full sheet on every tap (see cart-context.tsx addItem).
 * Desktop skips this: adding there opens the full popover directly.
 */
export function AddedToast() {
  const { justAdded, dismissJustAdded, openCart } = useCart();

  useEffect(() => {
    if (!justAdded) return;
    const timer = setTimeout(dismissJustAdded, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [justAdded, dismissJustAdded]);

  if (!justAdded) return null;

  return (
    <button
      type="button"
      onClick={() => {
        dismissJustAdded();
        openCart();
      }}
      className="animate-rise fixed inset-x-4 top-4 z-[100] flex items-center gap-3 rounded-full border border-ink/10 bg-paper px-4 py-3 text-left shadow-xl sm:hidden"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="shrink-0 text-teal">
        <path d="M6 6h15l-1.5 9h-12z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6 6L4 3H2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9" cy="20" r="1.2" />
        <circle cx="18" cy="20" r="1.2" />
      </svg>
      <span className="min-w-0 flex-1 truncate text-sm text-ink">
        <span className="font-medium">Added to cart</span> · {justAdded.name}
      </span>
    </button>
  );
}
