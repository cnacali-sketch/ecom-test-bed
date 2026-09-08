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
  onClearAll?: () => void;
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
    <fieldset className="border-b border-rule-soft py-[18px] first:pt-0">
      <legend className="mb-3 text-[11px] uppercase tracking-[0.18em] text-ink-soft">{title}</legend>
      <div className={isColor ? "flex flex-wrap gap-2" : "flex flex-col gap-2.5"}>
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
                className={`h-[26px] w-[26px] rounded-full border border-rule-soft outline outline-2 outline-offset-2 transition-colors ${
                  isActive ? "outline-teal" : "outline-transparent"
                }`}
                style={{ backgroundColor: COLOR_HEX_MAP[value] ?? "#d4d4d4" }}
              />
            );
          }

          return (
            <label key={value} className="flex cursor-pointer items-center justify-between gap-2.5 text-[13px] text-ink transition-colors hover:text-teal">
              <span className="flex flex-1 items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={() => onToggle(value)}
                  className="h-[15px] w-[15px] accent-teal"
                />
                {value}
              </span>
              <span className="text-xs tabular-nums text-ink-soft">({count})</span>
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
  onClearAll,
}: FilterSidebarProps) {
  return (
    <aside className="flex flex-col" aria-label="Product filters">
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

      <fieldset className="border-b border-rule-soft py-[18px]">
        <legend className="mb-3 text-[11px] uppercase tracking-[0.18em] text-ink-soft">Price</legend>
        <input
          type="range"
          min={0}
          max={priceCeiling}
          step={100}
          value={activeFilters.maxPrice ?? priceCeiling}
          onChange={(event) => onPriceChange(Number(event.target.value))}
          className="w-full accent-teal"
        />
        <div className="mt-1 flex justify-between text-xs text-ink-soft">
          <span>₹0</span>
          <span>
            Up to <b className="text-ink">₹{(activeFilters.maxPrice ?? priceCeiling).toLocaleString("en-IN")}</b>
          </span>
        </div>
      </fieldset>

      {onClearAll && (
        <button
          type="button"
          onClick={onClearAll}
          className="mt-[18px] w-full rounded-full border border-ink/25 py-3 text-center text-xs uppercase tracking-[0.14em] text-ink transition-colors hover:border-teal hover:text-teal"
        >
          Clear all
        </button>
      )}
    </aside>
  );
}
