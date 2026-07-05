"use client";

import type { FilterCounts } from "@/lib/types";

export interface ActiveFilters {
  brand: string[];
  type: string[];
  color: string[];
  material: string[];
  maxPrice: number | null;
}

interface FilterSidebarProps {
  counts: FilterCounts;
  activeFilters: ActiveFilters;
  priceCeiling: number;
  onToggleFilter: (facet: keyof FilterCounts, value: string) => void;
  onPriceChange: (maxPrice: number | null) => void;
}

interface FacetGroupProps {
  title: string;
  options: Record<string, number>;
  activeValues: string[];
  onToggle: (value: string) => void;
  isColor?: boolean;
}

const COLOR_HEX_MAP: Record<string, string> = {
  Black: "#1a1a1a",
  Tan: "#c8a06a",
  "Brick Red": "#a13d2b",
  Olive: "#5c6b45",
  Champagne: "#e8d9b5",
  Gold: "#d4af37",
  Silver: "#c0c0c0",
  Tortoise: "#6b4423",
  Blush: "#e8b4b8",
};

function FacetGroup({ title, options, activeValues, onToggle, isColor }: FacetGroupProps) {
  const entries = Object.entries(options);
  if (entries.length === 0) return null;

  return (
    <fieldset className="border-b border-neutral-200 pb-4">
      <legend className="mb-2 text-sm font-semibold text-neutral-900">{title}</legend>
      <div className={isColor ? "flex flex-wrap gap-2" : "flex flex-col gap-2"}>
        {entries.map(([value, count]) => {
          const isActive = activeValues.includes(value);

          if (isColor) {
            return (
              <button
                key={value}
                type="button"
                onClick={() => onToggle(value)}
                aria-pressed={isActive}
                title={`${value} (${count})`}
                className={`h-6 w-6 rounded-full border transition ${
                  isActive ? "ring-2 ring-neutral-900 ring-offset-1" : "border-neutral-300"
                }`}
                style={{ backgroundColor: COLOR_HEX_MAP[value] ?? "#d4d4d4" }}
              />
            );
          }

          return (
            <label key={value} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={() => onToggle(value)}
                  className="h-4 w-4 rounded border-neutral-300"
                />
                {value}
              </span>
              <span className="text-neutral-400">({count})</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Deep faceted search sidebar (France Luxe pattern): brand/type/color/price/
 * material, each option showing a live count.
 */
export function FilterSidebar({
  counts,
  activeFilters,
  priceCeiling,
  onToggleFilter,
  onPriceChange,
}: FilterSidebarProps) {
  return (
    <aside className="flex flex-col gap-4" aria-label="Product filters">
      <FacetGroup
        title="Brand"
        options={counts.brand}
        activeValues={activeFilters.brand}
        onToggle={(value) => onToggleFilter("brand", value)}
      />
      <FacetGroup
        title="Type"
        options={counts.type}
        activeValues={activeFilters.type}
        onToggle={(value) => onToggleFilter("type", value)}
      />
      <FacetGroup
        title="Color"
        options={counts.color}
        activeValues={activeFilters.color}
        onToggle={(value) => onToggleFilter("color", value)}
        isColor
      />
      <FacetGroup
        title="Material"
        options={counts.material}
        activeValues={activeFilters.material}
        onToggle={(value) => onToggleFilter("material", value)}
      />

      <fieldset className="pb-4">
        <legend className="mb-2 text-sm font-semibold text-neutral-900">Price</legend>
        <label className="flex flex-col gap-1 text-sm text-neutral-600">
          Up to {activeFilters.maxPrice ?? priceCeiling}
          <input
            type="range"
            min={0}
            max={priceCeiling}
            step={100}
            value={activeFilters.maxPrice ?? priceCeiling}
            onChange={(event) => onPriceChange(Number(event.target.value))}
            className="w-full"
          />
        </label>
      </fieldset>
    </aside>
  );
}
