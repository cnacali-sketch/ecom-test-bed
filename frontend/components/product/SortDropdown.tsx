"use client";

import type { SortOption } from "@/lib/types";

interface SortDropdownProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "best-selling", label: "Best Selling" },
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "az", label: "Alphabetical: A-Z" },
  { value: "za", label: "Alphabetical: Z-A" },
];

export function SortDropdown({ value, onChange }: SortDropdownProps) {
  return (
    <label className="inline-flex items-center gap-2 text-xs text-ink-soft">
      Sort
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as SortOption)}
        className="cursor-pointer rounded-full border border-rule-soft bg-warm-linen px-3.5 py-2 text-[13px] text-ink"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
