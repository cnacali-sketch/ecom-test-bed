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
      <p className="mb-2.5 text-sm text-ink">
        Color: <span className="text-ink-soft">{activeVariant?.color}</span>
        {activeVariant && <span className="ml-1.5 text-xs text-ink-soft/70">Ref. {activeVariant.sku}</span>}
        {activeVariant?.stockNote && (
          <span className="ml-2 text-xs font-medium text-sale">{activeVariant.stockNote}</span>
        )}
      </p>
      <div className="flex flex-wrap gap-2.5" role="group" aria-label="Color">
        {variants.map((variant) => (
          <button
            key={variant.id}
            type="button"
            onClick={() => onSelect(variant.id)}
            disabled={!variant.inStock}
            aria-pressed={variant.id === activeVariantId}
            aria-label={`${variant.color}${variant.inStock ? "" : " (sold out)"}`}
            className={`relative h-9 w-9 rounded-full border border-rule-soft outline outline-2 outline-offset-2 transition-colors ${
              variant.id === activeVariantId ? "outline-teal" : "outline-transparent"
            } ${!variant.inStock ? "cursor-not-allowed opacity-40" : ""}`}
            style={{ backgroundColor: variant.colorHex }}
          >
            {!variant.inStock && (
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="h-px w-6 rotate-45 bg-ink" aria-hidden="true" />
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
