"use client";

import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { formatPrice } from "@/lib/format";

const EMPTY_STATE_SHORTCUTS = [
  { label: "New In", href: "/collections/bags" },
  { label: "Best Sellers", href: "/collections/jewellery" },
  { label: "Bags", href: "/collections/bags" },
  { label: "Jewellery", href: "/collections/jewellery" },
];

const FREE_SHIPPING_THRESHOLD = 2999;

/** Slide-out cart: line items, subtotal, checkout CTA, empty-state w/ category shortcuts. */
export function CartDrawer() {
  const { items, isOpen, subtotal, closeCart, removeItem, updateQuantity } = useCart();

  if (!isOpen) return null;

  const remainingForFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      <button
        type="button"
        aria-label="Close cart"
        onClick={closeCart}
        className="absolute inset-0 bg-black/40"
      />

      <div className="relative flex h-full w-full max-w-md flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-neutral-900">Your Cart</h2>
          <button
            type="button"
            aria-label="Close cart"
            onClick={closeCart}
            className="text-neutral-500 hover:text-neutral-900"
          >
            ✕
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
            <p className="text-sm text-neutral-600">Your cart is empty</p>
            <div className="flex flex-wrap justify-center gap-2">
              {EMPTY_STATE_SHORTCUTS.map((shortcut) => (
                <Link
                  key={shortcut.label}
                  href={shortcut.href}
                  onClick={closeCart}
                  className="rounded-full border border-neutral-300 px-4 py-1.5 text-xs font-medium text-neutral-700 hover:border-neutral-900 hover:text-neutral-900"
                >
                  {shortcut.label}
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <>
            <ul className="flex-1 overflow-y-auto px-6 py-4">
              {items.map((item) => (
                <li key={item.variantId} className="flex gap-4 border-b border-neutral-100 py-4">
                  <div className="relative h-24 w-20 shrink-0 overflow-hidden bg-neutral-100">
                    <Image src={item.image} alt={item.name} fill sizes="80px" className="object-cover" />
                  </div>
                  <div className="flex flex-1 flex-col justify-between">
                    <div>
                      <p className="text-sm font-medium text-neutral-900">{item.name}</p>
                      <p className="text-xs text-neutral-500">
                        {item.color}
                        {item.size ? ` · ${item.size}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs text-neutral-600">
                        Qty
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(event) =>
                            updateQuantity(item.variantId, Number(event.target.value))
                          }
                          className="w-14 rounded border border-neutral-300 px-2 py-1"
                        />
                      </label>
                      <span className="text-sm font-medium text-neutral-900">
                        {formatPrice(item.price * item.quantity, item.currency)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.variantId)}
                      className="self-start text-xs text-neutral-400 underline hover:text-neutral-700"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="border-t border-neutral-200 px-6 py-4">
              {remainingForFreeShipping > 0 ? (
                <p className="mb-3 text-xs text-neutral-500">
                  Add {formatPrice(remainingForFreeShipping)} more for free shipping
                </p>
              ) : (
                <p className="mb-3 text-xs text-emerald-700">You&apos;ve unlocked free shipping</p>
              )}
              <div className="mb-4 flex items-center justify-between text-sm font-medium text-neutral-900">
                <span>Subtotal</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <button
                type="button"
                className="w-full rounded bg-neutral-900 py-3 text-sm font-medium text-white hover:bg-neutral-700"
              >
                Checkout
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
