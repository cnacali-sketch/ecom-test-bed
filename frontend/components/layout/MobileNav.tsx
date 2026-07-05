"use client";

import Link from "next/link";
import { useState } from "react";
import { siteConfig } from "@/content/site.config";

interface MobileNavProps {
  onClose: () => void;
}

/**
 * Full-screen mobile navigation with accordion expanders per section
 * (the Accessorize mobile pattern). Content comes from site config.
 */
export function MobileNav({ onClose }: MobileNavProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-[90] lg:hidden">
      <button type="button" aria-label="Close menu" onClick={onClose} className="absolute inset-0 bg-ink/40" />
      <div className="animate-rise absolute inset-y-0 left-0 flex w-full max-w-sm flex-col overflow-y-auto bg-paper shadow-xl">
        <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
          <span className="eyebrow">Menu</span>
          <button type="button" aria-label="Close menu" onClick={onClose} className="text-ink">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 px-5 py-2">
          {siteConfig.nav.map((item) => (
            <div key={item.label} className="border-b border-ink/10">
              <div className="flex items-center justify-between">
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={`py-4 text-sm uppercase tracking-[0.14em] ${
                    item.label === "Sale" ? "text-sale" : "text-ink"
                  }`}
                >
                  {item.label}
                </Link>
                {item.megaMenu && (
                  <button
                    type="button"
                    aria-label={`Expand ${item.label}`}
                    aria-expanded={expanded === item.label}
                    onClick={() => setExpanded(expanded === item.label ? null : item.label)}
                    className="p-3 text-ink-soft"
                  >
                    <span aria-hidden>{expanded === item.label ? "−" : "+"}</span>
                  </button>
                )}
              </div>
              {item.megaMenu && expanded === item.label && (
                <div className="pb-4">
                  {item.megaMenu.columns.map((column) => (
                    <div key={column.heading} className="mb-3">
                      <p className="eyebrow mb-2">{column.heading}</p>
                      <ul className="flex flex-col gap-2">
                        {column.links.map((link) => (
                          <li key={link.label}>
                            <Link href={link.href} onClick={onClose} className="text-sm text-ink-soft hover:text-teal">
                              {link.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </div>
    </div>
  );
}
