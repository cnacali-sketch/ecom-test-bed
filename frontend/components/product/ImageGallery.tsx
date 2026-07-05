"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import type { ProductImage } from "@/lib/types";

interface ImageGalleryProps {
  images: ProductImage[];
}

/**
 * PDP gallery.
 * Mobile: swipeable snap-scroll carousel with dot indicators.
 * Desktop: large active image + thumbnail rail.
 */
export function ImageGallery({ images }: ImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const activeImage = images[activeIndex] ?? images[0];

  if (!activeImage) return null;

  // Keep the dots in sync with swipe position on mobile.
  const handleScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    const index = Math.round(track.scrollLeft / track.clientWidth);
    if (index !== activeIndex) setActiveIndex(index);
  };

  return (
    <div>
      {/* Mobile: swipeable carousel */}
      <div className="lg:hidden">
        <div
          ref={trackRef}
          onScroll={handleScroll}
          className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Product images, swipe to browse"
        >
          {images.map((image) => (
            <div key={image.url} className="relative aspect-[4/5] w-full shrink-0 snap-center bg-paper-tint">
              <Image
                src={image.url}
                alt={image.alt}
                fill
                priority={image === images[0]}
                sizes="100vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>
        {images.length > 1 && (
          <div className="mt-3 flex justify-center gap-2" aria-hidden>
            {images.map((image, index) => (
              <span
                key={image.url}
                className={`h-1.5 rounded-full transition-all ${
                  index === activeIndex ? "w-6 bg-teal" : "w-1.5 bg-ink/20"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Desktop: active image + thumbnails */}
      <div className="hidden flex-col gap-3 lg:flex">
        <div className="relative aspect-[4/5] w-full overflow-hidden bg-paper-tint">
          <Image
            src={activeImage.url}
            alt={activeImage.alt}
            fill
            priority
            sizes="50vw"
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
                className={`relative h-20 w-16 shrink-0 overflow-hidden border transition-colors ${
                  index === activeIndex ? "border-teal" : "border-ink/15 hover:border-ink/40"
                }`}
              >
                <Image src={image.url} alt={image.alt} fill sizes="64px" className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
