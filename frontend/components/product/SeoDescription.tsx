"use client";

import { useState } from "react";

interface SeoDescriptionProps {
  text: string;
  truncateAt?: number;
}

/** Collapsible "Read more" SEO copy pattern seen on every France Luxe collection page. */
export function SeoDescription({ text, truncateAt = 180 }: SeoDescriptionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isTruncatable = text.length > truncateAt;
  const displayText = isExpanded || !isTruncatable ? text : `${text.slice(0, truncateAt)}…`;

  return (
    <div className="max-w-2xl text-sm leading-relaxed text-neutral-600">
      <p>{displayText}</p>
      {isTruncatable && (
        <button
          type="button"
          onClick={() => setIsExpanded((current) => !current)}
          className="mt-1 font-medium text-neutral-900 underline"
        >
          {isExpanded ? "Read less" : "Read more"}
        </button>
      )}
    </div>
  );
}
