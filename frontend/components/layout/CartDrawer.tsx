"use client";

import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { formatPrice } from "@/lib/format";

import { siteConfig } from "@/content/site.config";

// Empty-cart shortcuts mirror the main nav (config-driven).
const EMPTY_STATE_SHORTCUTS = siteConfig.nav.map(({ label, href }) => ({ label, href }));

const FREE_SHIPPING_THRESHOLD = 1499;

/**
 * Cart popover: a thumb-reachable bottom sheet on mobile (fast checkout —
 * the CTA stays within reach without scrolling to the screen's top corner),
 * a floating top-right popout on desktop (mirrors the cart icon's corner
 * instead of a full-height side drawer).
 */
export function CartDrawer() {
  const { items, isOpen, subtotal, closeCart, removeItem, updateQuantity } = useCart();

  if (!isOpen) return null;

  const remainingForFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);

  return (
    <div className="fixed inset-0 z-[100]">
      <button
        type="button"
        aria-label="Close cart"
        onClick={closeCart}
        className="animate-fade absolute inset-0 bg-ink/40"
      />

      <div className="animate-rise fixed inset-x-0 bottom-0 z-[101] flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-[28px] bg-paper shadow-xl sm:inset-x-auto sm:inset-y-auto sm:bottom-auto sm:left-auto sm:right-6 sm:top-6 sm:h-auto sm:max-h-[calc(100vh-3rem)] sm:w-full sm:max-w-md sm:rounded-[28px] sm:shadow-2xl">
        <div className="flex items-center justify-between border-b border-rule-soft px-6 py-4">
          <h2 className="font-display text-xl italic text-ink">Your cart</h2>
          <button
            type="button"
            aria-label="Close cart"
            onClick={closeCart}
            className="grid h-9 w-9 place-items-center rounded-full text-ink-soft transition-colors hover:bg-warm-linen hover:text-ink"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
            <p className="text-sm text-ink-soft">Your cart is empty</p>
            <div className="flex flex-wrap justify-center gap-2">
              {EMPTY_STATE_SHORTCUTS.map((shortcut) => (
                <Link
                  key={shortcut.label}
                  href={shortcut.href}
                  onClick={closeCart}
                  className="rounded-full border border-rule-soft px-4 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-teal hover:text-teal"
                >
                  {shortcut.label}
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <>
            <ul className="flex-1 overflow-y-auto overscroll-contain px-6 py-4">
              {items.map((item) => (
                <li key={item.variantId} className="flex gap-4 border-b border-rule-soft py-4">
                  <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-2xl bg-warm-linen">
                    <Image src={item.image} alt={item.name} fill sizes="80px" className="object-cover" />
                  </div>
                  <div className="flex flex-1 flex-col justify-between">
                    <div>
                      <p className="text-sm font-medium text-ink">{item.name}</p>
                      <p className="text-xs text-ink-soft">
                        {item.color}
                        {item.size ? ` · ${item.size}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      {/* Thumb-friendly stepper — matches the product-grid control. */}
                      <div className="flex items-center overflow-hidden rounded-full border border-rule-soft text-ink" aria-label={`${item.name} quantity`}>
                        <button
                          type="button"
                          aria-label="Decrease quantity"
                          onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                          className="grid h-8 w-8 place-items-center text-base transition-colors hover:bg-teal hover:text-white"
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-[13px] font-semibold tabular-nums" aria-live="polite">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          aria-label="Increase quantity"
                          onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                          className="grid h-8 w-8 place-items-center text-base transition-colors hover:bg-teal hover:text-white"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-sm font-medium text-ink">
                        {formatPrice(item.price * item.quantity, item.currency)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.variantId)}
                      className="self-start text-xs text-ink-soft underline underline-offset-2 transition-colors hover:text-sale"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="border-t border-rule-soft px-6 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              {remainingForFreeShipping > 0 ? (
                <p className="mb-3 text-xs text-ink-soft">
                  Add {formatPrice(remainingForFreeShipping)} more for free shipping
                </p>
              ) : (
                <p className="mb-3 text-xs font-medium text-teal">You&apos;ve unlocked free shipping</p>
              )}
              <div className="mb-4 flex items-center justify-between text-sm font-medium text-ink">
                <span>Subtotal</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <Link
                href="/checkout"
                onClick={closeCart}
                className="block w-full rounded-full bg-teal py-3 text-center text-sm font-medium uppercase tracking-wide text-white transition-colors hover:bg-teal-deep"
              >
                Checkout
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
