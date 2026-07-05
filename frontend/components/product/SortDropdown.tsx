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
    <label className="flex items-center gap-2 text-sm text-neutral-700">
      Sort by
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as SortOption)}
        className="rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm"
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
