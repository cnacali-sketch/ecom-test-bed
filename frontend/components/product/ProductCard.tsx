"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { Product } from "@/lib/types";
import { PriceBlock } from "./PriceBlock";

interface ProductCardProps {
  product: Product;
}

/**
 * Shared spine component: image + hover-swap alt image, swatch-toggle
 * (France Luxe pattern), title, PriceBlock, Sale/NEW badge, Sold Out state.
 */
export function ProductCard({ product }: ProductCardProps) {
  const [activeVariantIndex, setActiveVariantIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const activeVariant = product.variants[activeVariantIndex];
  const primaryImage = activeVariant?.image ?? product.images[0]?.url;
  const secondaryImage = product.images[1]?.url ?? primaryImage;
  const displayImage = isHovered ? secondaryImage : primaryImage;

  return (
    <div className="group flex flex-col">
      <Link
        href={`/products/${product.slug}`}
        className="relative block aspect-[4/5] overflow-hidden bg-neutral-100"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Image
          src={displayImage}
          alt={product.name}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          className="object-cover transition-opacity duration-300"
        />

        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {product.isNew && (
            <span className="bg-neutral-900 px-2 py-1 text-xs font-medium uppercase tracking-wide text-white">
              New
            </span>
          )}
          {product.isSale && (
            <span className="bg-rose-700 px-2 py-1 text-xs font-medium uppercase tracking-wide text-white">
              Sale
            </span>
          )}
        </div>

        {!product.inStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <span className="bg-neutral-900 px-3 py-1 text-xs font-medium uppercase tracking-wide text-white">
              Sold Out
            </span>
          </div>
        )}
      </Link>

      {product.variants.length > 1 && (
        <div className="mt-2 flex gap-1.5" role="group" aria-label={`Colors for ${product.name}`}>
          {product.variants.map((variant, index) => (
            <button
              key={variant.id}
              type="button"
              onClick={() => setActiveVariantIndex(index)}
              aria-label={`View ${variant.color}`}
              aria-pressed={index === activeVariantIndex}
              className={`h-4 w-4 rounded-full border transition ${
                index === activeVariantIndex
                  ? "ring-2 ring-neutral-900 ring-offset-1"
                  : "border-neutral-300"
              }`}
              style={{ backgroundColor: variant.colorHex }}
            />
          ))}
        </div>
      )}

      <Link href={`/products/${product.slug}`} className="mt-2">
        <p className="text-xs uppercase tracking-wide text-neutral-500">{product.brand}</p>
        <h3 className="text-sm font-medium text-neutral-900">{product.name}</h3>
      </Link>

      <div className="mt-1">
        <PriceBlock price={product.price} mrp={product.mrp} currency={product.currency} size="sm" />
      </div>
    </div>
  );
}
