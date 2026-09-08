"use client";

import { useMemo, useState } from "react";
import type { FilterCounts, Product, SortOption } from "@/lib/types";
import type { ActiveFilters } from "./FilterSidebar";
import { FilterSidebar } from "./FilterSidebar";
import { ProductCard } from "./ProductCard";
import { SortDropdown } from "./SortDropdown";

interface ProductGridProps {
  products: Product[];
}

const EMPTY_FILTERS: ActiveFilters = {
  brand: [],
  type: [],
  color: [],
  material: [],
  maxPrice: null,
};

function buildFacetCounts(products: Product[]): FilterCounts {
  const counts: FilterCounts = { brand: {}, type: {}, color: {}, material: {} };

  for (const product of products) {
    counts.brand[product.brand] = (counts.brand[product.brand] ?? 0) + 1;
    counts.type[product.type] = (counts.type[product.type] ?? 0) + 1;
    counts.material[product.material] = (counts.material[product.material] ?? 0) + 1;
    for (const variant of product.variants) {
      counts.color[variant.color] = (counts.color[variant.color] ?? 0) + 1;
    }
  }

  return counts;
}

function matchesFilters(product: Product, filters: ActiveFilters): boolean {
  if (filters.brand.length > 0 && !filters.brand.includes(product.brand)) return false;
  if (filters.type.length > 0 && !filters.type.includes(product.type)) return false;
  if (filters.material.length > 0 && !filters.material.includes(product.material)) return false;
  if (
    filters.color.length > 0 &&
    !product.variants.some((variant) => filters.color.includes(variant.color))
  ) {
    return false;
  }
  if (filters.maxPrice !== null && product.price > filters.maxPrice) return false;
  return true;
}

function sortProducts(products: Product[], sort: SortOption): Product[] {
  const sorted = [...products];
  switch (sort) {
    case "price-asc":
      return sorted.sort((a, b) => a.price - b.price);
    case "price-desc":
      return sorted.sort((a, b) => b.price - a.price);
    case "az":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case "za":
      return sorted.sort((a, b) => b.name.localeCompare(a.name));
    case "newest":
      return sorted.sort((a, b) => Number(b.isNew) - Number(a.isNew));
    case "best-selling":
      return sorted.sort((a, b) => Number(b.tags.includes("best-seller")) - Number(a.tags.includes("best-seller")));
    default:
      return sorted;
  }
}

/** Faceted collection/listing template: filters + sort + responsive product grid. */
export function ProductGrid({ products }: ProductGridProps) {
  const [filters, setFilters] = useState<ActiveFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortOption>("featured");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const priceCeiling = useMemo(
    () => Math.max(...products.map((product) => product.price), 0),
    [products],
  );

  const counts = useMemo(() => buildFacetCounts(products), [products]);

  const visibleProducts = useMemo(() => {
    const filtered = products.filter((product) => matchesFilters(product, filters));
    return sortProducts(filtered, sort);
  }, [products, filters, sort]);

  const toggleFilter = (facet: keyof FilterCounts, value: string) => {
    setFilters((current) => {
      const currentValues = current[facet];
      const nextValues = currentValues.includes(value)
        ? currentValues.filter((item) => item !== value)
        : [...currentValues, value];
      return { ...current, [facet]: nextValues };
    });
  };

  const handlePriceChange = (maxPrice: number | null) => {
    setFilters((current) => ({ ...current, maxPrice }));
  };

  const activeFilterCount =
    filters.brand.length +
    filters.type.length +
    filters.color.length +
    filters.material.length +
    (filters.maxPrice !== null ? 1 : 0);

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[232px_1fr]">
      {/* Desktop: persistent sidebar. Mobile: filters live in a bottom sheet. */}
      <div className="hidden lg:block">
        <FilterSidebar
          counts={counts}
          activeFilters={filters}
          priceCeiling={priceCeiling}
          onToggleFilter={toggleFilter}
          onPriceChange={handlePriceChange}
          onClearAll={() => setFilters(EMPTY_FILTERS)}
        />
      </div>

      <div>
        <div className="mb-[18px] flex flex-wrap items-center gap-3.5 border-b border-rule-soft pb-[18px]">
          <button
            type="button"
            onClick={() => setMobileFiltersOpen(true)}
            className="flex items-center gap-2 rounded-full border border-rule-soft px-4 py-2 text-xs uppercase tracking-[0.14em] text-ink lg:hidden"
          >
            Filters
            {activeFilterCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal text-[10px] text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
          <p className="text-xs tracking-[0.04em] text-ink-soft">{visibleProducts.length} products</p>
          <SortDropdown value={sort} onChange={setSort} />
        </div>

        {visibleProducts.length === 0 ? (
          <p className="py-16 text-center text-sm text-ink-soft">
            No products match the selected filters.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-4">
            {visibleProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>

      {/* Mobile filter bottom sheet */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-[85] lg:hidden">
          <button
            type="button"
            aria-label="Close filters"
            onClick={() => setMobileFiltersOpen(false)}
            className="absolute inset-0 bg-ink/40"
          />
          <div className="animate-rise absolute inset-x-0 bottom-0 flex max-h-[80vh] flex-col rounded-t-[28px] bg-paper">
            <div className="flex items-center justify-between border-b border-rule-soft px-5 py-4">
              <span className="eyebrow">Filters</span>
              <button
                type="button"
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="text-xs uppercase tracking-[0.14em] text-ink-soft"
              >
                Clear all
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <FilterSidebar
                counts={counts}
                activeFilters={filters}
                priceCeiling={priceCeiling}
                onToggleFilter={toggleFilter}
                onPriceChange={handlePriceChange}
              />
            </div>
            <div className="border-t border-rule-soft p-4">
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="w-full rounded-full bg-teal py-3.5 text-xs uppercase tracking-[0.18em] text-white"
              >
                Show {visibleProducts.length} products
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
