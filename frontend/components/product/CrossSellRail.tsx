import type { Product } from "@/lib/types";
import { ProductCard } from "./ProductCard";

interface CrossSellRailProps {
  title?: string;
  products: Product[];
}

/** "Complete your look" cross-sell rail (Zara pattern), reused for related products. */
export function CrossSellRail({ title = "Complete Your Look", products }: CrossSellRailProps) {
  if (products.length === 0) return null;

  return (
    <section aria-label={title} className="mt-16">
      <h2 className="mb-6 text-lg font-semibold text-neutral-900">{title}</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
