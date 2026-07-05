import type { Currency } from "./types";

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  INR: "₹",
  USD: "$",
};

const DEFAULT_CURRENCY: Currency = "INR";

/**
 * Formats a numeric amount as currency. Defaults to INR (₹) since two of the
 * three reference sites are India-focused. Change DEFAULT_CURRENCY (or pass an
 * explicit currency) to swap markets later — this is the single line to touch.
 */
export function formatPrice(amount: number, currency: Currency = DEFAULT_CURRENCY): string {
  const symbol = CURRENCY_SYMBOLS[currency];
  const hasFractionalPart = currency === "USD";

  const formatted = amount.toLocaleString("en-IN", {
    minimumFractionDigits: hasFractionalPart ? 2 : 0,
    maximumFractionDigits: hasFractionalPart ? 2 : 0,
  });

  return `${symbol}${formatted}`;
}

export function calculateDiscountPercent(mrp: number, price: number): number {
  if (mrp <= price || mrp <= 0) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}
