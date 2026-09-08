"use client";

import { useState } from "react";

interface AccordionSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

/**
 * Generic reusable accordion used for PDP sections (Description, Care,
 * Measurements, Shipping) and the homepage FAQ block.
 */
export function AccordionSection({ title, children, defaultOpen = false }: AccordionSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-rule-soft">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between py-4 text-left text-sm font-medium text-ink"
      >
        {title}
        <span aria-hidden="true" className={`transition-transform ${isOpen ? "rotate-45" : ""}`}>
          +
        </span>
      </button>
      {isOpen && <div className="pb-4 text-sm leading-relaxed text-ink-soft">{children}</div>}
    </div>
  );
}
