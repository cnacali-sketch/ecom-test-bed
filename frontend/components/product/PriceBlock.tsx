import { calculateDiscountPercent, formatPrice } from "@/lib/format";
import type { Currency } from "@/lib/types";

interface PriceBlockProps {
  price: number;
  mrp: number;
  currency?: Currency;
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASSES: Record<NonNullable<PriceBlockProps["size"]>, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-xl",
};

/**
 * Reusable price block: strikethrough MRP + sale price + discount %.
 * Shared across ProductCard, PDP, and CrossSellRail per the graph's
 * cross-site "price-block" convergence.
 */
export function PriceBlock({ price, mrp, currency = "INR", size = "md" }: PriceBlockProps) {
  const isOnSale = mrp > price;
  const discountPercent = calculateDiscountPercent(mrp, price);
  const sizeClass = SIZE_CLASSES[size];

  return (
    <div className={`flex flex-wrap items-baseline gap-2 ${sizeClass}`}>
      <span className="font-semibold text-neutral-900">{formatPrice(price, currency)}</span>
      {isOnSale && (
        <>
          <span className="text-neutral-400 line-through">{formatPrice(mrp, currency)}</span>
          <span className="font-medium text-rose-700">{discountPercent}% off</span>
        </>
      )}
    </div>
  );
}
