"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/lib/cart-context";
import { MegaMenu } from "./MegaMenu";
import { NAV_ITEMS } from "./nav-data";

/**
 * Global chrome: announcement bar, logo, search, account, cart icon with
 * live item-count badge, and the mega-menu nav row (Accessorize pattern).
 */
export function Header() {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const { itemCount, openCart } = useCart();

  return (
    <header className="relative z-50 border-b border-neutral-200 bg-white">
      <div className="bg-neutral-900 py-2 text-center text-xs tracking-wide text-white">
        Free shipping on orders over ₹2,999 — Easy 15-day returns
      </div>

      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
        <Link href="/" className="text-xl font-bold tracking-tight text-neutral-900">
          Savvy
        </Link>

        <nav
          className="hidden items-center gap-6 lg:flex"
          onMouseLeave={() => setActiveMenu(null)}
        >
          {NAV_ITEMS.map((item) => (
            <div key={item.label} onMouseEnter={() => setActiveMenu(item.label)}>
              <Link
                href={item.href}
                className="text-sm font-medium text-neutral-700 hover:text-neutral-900"
              >
                {item.label}
              </Link>
              {item.megaMenu && activeMenu === item.label && <MegaMenu {...item.megaMenu} />}
            </div>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <button type="button" aria-label="Search" className="text-neutral-700 hover:text-neutral-900">
            <SearchIcon />
          </button>
          <Link href="/account" aria-label="Account" className="text-neutral-700 hover:text-neutral-900">
            <AccountIcon />
          </Link>
          <button
            type="button"
            aria-label={`Cart, ${itemCount} items`}
            onClick={openCart}
            className="relative text-neutral-700 hover:text-neutral-900"
          >
            <CartIcon />
            {itemCount > 0 && (
              <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-medium text-white">
                {itemCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
    </svg>
  );
}

function AccountIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.5-6 8-6s8 2 8 6" strokeLinecap="round" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 6h15l-1.5 9h-12z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 6L4 3H2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="20" r="1.2" />
      <circle cx="18" cy="20" r="1.2" />
    </svg>
  );
}
