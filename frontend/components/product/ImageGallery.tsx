"use client";

import Image from "next/image";
import { useState } from "react";
import type { ProductImage } from "@/lib/types";

interface ImageGalleryProps {
  images: ProductImage[];
}

/**
 * PDP hero gallery. Supports a single editorial hero (Zara-style, one large
 * image) or multi-thumbnail mode when more than one image is available.
 */
export function ImageGallery({ images }: ImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeImage = images[activeIndex] ?? images[0];

  if (!activeImage) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-neutral-100">
        <Image
          src={activeImage.url}
          alt={activeImage.alt}
          fill
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover"
        />
      </div>

      {images.length > 1 && (
        <div className="flex gap-2" role="tablist" aria-label="Product images">
          {images.map((image, index) => (
            <button
              key={image.url + index}
              type="button"
              role="tab"
              aria-selected={index === activeIndex}
              onClick={() => setActiveIndex(index)}
              className={`relative h-20 w-16 shrink-0 overflow-hidden border ${
                index === activeIndex ? "border-neutral-900" : "border-neutral-200"
              }`}
            >
              <Image src={image.url} alt={image.alt} fill sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
