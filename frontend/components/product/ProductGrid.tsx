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

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[240px_1fr]">
      <FilterSidebar
        counts={counts}
        activeFilters={filters}
        priceCeiling={priceCeiling}
        onToggleFilter={toggleFilter}
        onPriceChange={handlePriceChange}
      />

      <div>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-neutral-500">{visibleProducts.length} products</p>
          <SortDropdown value={sort} onChange={setSort} />
        </div>

        {visibleProducts.length === 0 ? (
          <p className="py-16 text-center text-sm text-neutral-500">
            No products match the selected filters.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {visibleProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
