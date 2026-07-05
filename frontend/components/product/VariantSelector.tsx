"use client";

import type { ProductVariant } from "@/lib/types";

interface VariantSelectorProps {
  variants: ProductVariant[];
  activeVariantId: string;
  onSelect: (variantId: string) => void;
}

/** Color/size swatch selector used on the PDP. */
export function VariantSelector({ variants, activeVariantId, onSelect }: VariantSelectorProps) {
  const activeVariant = variants.find((variant) => variant.id === activeVariantId);

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-neutral-900">
        Color: <span className="font-normal text-neutral-600">{activeVariant?.color}</span>
        {activeVariant && (
          <span className="ml-1 text-xs text-neutral-400">Ref. {activeVariant.sku}</span>
        )}
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Color">
        {variants.map((variant) => (
          <button
            key={variant.id}
            type="button"
            onClick={() => onSelect(variant.id)}
            disabled={!variant.inStock}
            aria-pressed={variant.id === activeVariantId}
            aria-label={`${variant.color}${variant.inStock ? "" : " (sold out)"}`}
            className={`relative h-9 w-9 rounded-full border transition ${
              variant.id === activeVariantId
                ? "ring-2 ring-neutral-900 ring-offset-1"
                : "border-neutral-300"
            } ${!variant.inStock ? "cursor-not-allowed opacity-40" : ""}`}
            style={{ backgroundColor: variant.colorHex }}
          >
            {!variant.inStock && (
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="h-px w-6 rotate-45 bg-neutral-900" aria-hidden="true" />
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
