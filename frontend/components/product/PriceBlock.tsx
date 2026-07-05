import { calculateDiscountPercent, formatPrice } from "@/lib/format";
import type { Currency } from "@/lib/types";
import { siteConfig } from "@/content/site.config";

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
      <span className="font-semibold text-ink">{formatPrice(price, currency)}</span>
      {isOnSale && (
        <>
          <span className="text-ink-soft/70 line-through">{formatPrice(mrp, currency)}</span>
          <span className="font-medium text-sale">{discountPercent}% off</span>
        </>
      )}
      {siteConfig.brand.taxLine && size !== "sm" && (
        <span className="w-full text-[10px] uppercase tracking-[0.1em] text-ink-soft/70">
          {siteConfig.brand.taxLine}
        </span>
      )}
    </div>
  );
}
