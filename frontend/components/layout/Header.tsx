"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { siteConfig } from "@/content/site.config";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
import { MegaMenu } from "./MegaMenu";
import { MobileNav } from "./MobileNav";
import { SearchOverlay } from "./SearchOverlay";

/**
 * Global chrome: scrolling announcement marquee, logo, mega-menu nav,
 * search overlay, cart trigger, and mobile accordion nav.
 * All copy/links come from content/site.config.ts.
 */
interface HeaderProps {
  /** Admin override for the announcement ribbon (see GET /api/sections),
   * fetched server-side in layout.tsx since this is a client component.
   * Both fields null means "use content/site.config.ts's default". */
  announcementOverride?: { enabled: boolean | null; messages: string[] | null };
}

export function Header({ announcementOverride }: HeaderProps = {}) {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { itemCount, openCart } = useCart();
  const { user } = useAuth();
  const { brand, nav } = siteConfig;
  const announcement = {
    enabled: announcementOverride?.enabled ?? siteConfig.announcement.enabled,
    messages:
      announcementOverride?.messages && announcementOverride.messages.length > 0
        ? announcementOverride.messages
        : siteConfig.announcement.messages,
  };

  // Send signed-out shoppers straight to the sign-in page; signed-in ones to
  // their account. Avoids the /account "Loading…" → redirect bounce.
  const accountHref = user ? "/account" : "/login";

  // Mega-menu hover: keep it open while the cursor crosses the gap between the
  // nav link and the flyout. A short close delay (cancelled on re-enter) bridges
  // that dead zone instead of the menu vanishing mid-move.
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openMenu = (label: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setActiveMenu(label);
  };
  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setActiveMenu(null), 150);
  };

  return (
    <header className="relative z-50 border-b border-ink/10 bg-paper">
      {announcement.enabled && (
        <div className="overflow-hidden bg-teal py-1.5 text-white" aria-label="Announcements">
          <div className="animate-marquee flex w-max gap-12 whitespace-nowrap text-[11px] uppercase tracking-[0.18em]">
            {[...announcement.messages, ...announcement.messages].map((message, index) => (
              <span key={index} className="flex items-center gap-12">
                {message} <span aria-hidden className="text-gold">✿</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-4 sm:px-6">
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setMobileOpen(true)}
          className="text-ink lg:hidden"
        >
          <MenuIcon />
        </button>

        <Link href="/" className="shrink-0" aria-label={brand.name}>
          <Image
            src={brand.logo.src}
            alt={brand.logo.alt}
            width={brand.logo.width}
            height={brand.logo.height}
            priority
            className="h-12 w-auto sm:h-16"
          />
        </Link>

        <nav
          className="hidden items-center gap-7 lg:flex"
          onMouseLeave={scheduleClose}
        >
          {nav.map((item) => (
            <div key={item.label} onMouseEnter={() => openMenu(item.label)}>
              <Link
                href={item.href}
                className={`text-[13px] uppercase tracking-[0.14em] transition-colors ${
                  item.label === "Sale" ? "text-sale" : "text-ink hover:text-teal"
                }`}
              >
                {item.label}
              </Link>
              {item.megaMenu && activeMenu === item.label && (
                <div onMouseEnter={() => openMenu(item.label)}>
                  <MegaMenu {...item.megaMenu} />
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <button
            type="button"
            aria-label="Search"
            onClick={() => setSearchOpen(true)}
            className="text-ink transition-colors hover:text-teal"
          >
            <SearchIcon />
          </button>
          <Link
            href={accountHref}
            aria-label={user ? "Account" : "Sign in"}
            className="text-ink transition-colors hover:text-teal"
          >
            <AccountIcon />
          </Link>
          <button
            type="button"
            aria-label={`Cart, ${itemCount} items`}
            onClick={openCart}
            className="relative text-ink transition-colors hover:text-teal"
          >
            <CartIcon />
            {itemCount > 0 && (
              <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-teal text-[10px] font-medium text-white">
                {itemCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {mobileOpen && <MobileNav onClose={() => setMobileOpen(false)} />}
      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
    </header>
  );
}

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
    </svg>
  );
}

function AccountIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.5-6 8-6s8 2 8 6" strokeLinecap="round" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 6h15l-1.5 9h-12z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 6L4 3H2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="20" r="1.2" />
      <circle cx="18" cy="20" r="1.2" />
    </svg>
  );
}
