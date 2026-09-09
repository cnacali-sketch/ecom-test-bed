"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { siteConfig } from "@/content/site.config";
import { apiBaseUrl } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { adaptProduct, type BackendProduct } from "@/lib/backend-adapter";
import { useCart } from "@/lib/cart-context";
import type { Product } from "@/lib/types";
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
  // The searchable catalogue lives here, not in SearchOverlay, so it survives
  // the overlay unmounting: fetched once on the first open and reused after,
  // instead of re-downloading every product each time search is opened.
  // Lazy rather than on mount -- a visitor who never searches never pays for it.
  const [catalog, setCatalog] = useState<Product[] | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const catalogRequested = useRef(false);
  const { itemCount, openCart } = useCart();
  const { user } = useAuth();
  const { brand, nav } = siteConfig;

  // Only the homepage has a hero for the header to float over; every other
  // route keeps today's normal in-flow header untouched (no positioning or
  // compensation changes needed there at all).
  const pathname = usePathname();
  const isHome = pathname === "/";

  // Scroll progress 0→1 over DISTANCE px, mirroring the design prototype's
  // header crossfade (chrome.js). The value is written to a CSS custom
  // property on <html> inside a rAF callback — a style mutation, not React
  // state — so the bar interpolates into the pill every frame without
  // re-rendering the tree. globals.css (.nav-morph*) does the rest.
  //
  // `pillActive` IS React state, but it only flips once per crossing: it
  // gates pointer-events / focusability, which have to be real DOM
  // attributes rather than interpolated styles.
  const [pillActive, setPillActive] = useState(false);
  // Mirrors pillActive so commit() can tell whether the threshold actually
  // changed without reading state (which the rAF closure would capture
  // stale). A ref rather than a local: it has to survive the effect being
  // torn down and re-run on navigation, so returning to "/" from another
  // route doesn't leave a stale value behind.
  const pillActiveRef = useRef(false);
  useEffect(() => {
    const root = document.documentElement;
    if (!isHome) {
      root.style.setProperty("--nav-p", "0");
      // Deliberately no setPillActive here: `overHero` is already gated on
      // isHome, so the value is unread off the homepage, and setting state
      // synchronously in an effect body triggers a cascading render.
      return;
    }

    // Fixed distance, not the hero's height: the hero is a full viewport
    // tall, and stretching the transition over 100vh would leave the
    // header half-swapped for most of the first screen.
    const DISTANCE = 220;
    // Phones use scroll DIRECTION rather than position (as the prototype
    // did): bare widgets over the hero at rest, pill once the user starts
    // moving down, bare again on the way back up. On a phone the header
    // covers a much larger share of the screen, so tying it to absolute
    // position leaves it half-formed for most of a scroll.
    const phone = window.matchMedia("(max-width: 680px)");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const TOP_ZONE = 40; // above this the pill is always hidden
    const DELTA = 6; // deadzone — ignore sub-pixel jitter
    let ticking = false;
    let lastY = window.scrollY;
    let pillShown = false;

    function setP(p: number) {
      root.style.setProperty("--nav-p", String(p));
      const active = p > 0.6;
      if (active !== pillActiveRef.current) {
        pillActiveRef.current = active;
        setPillActive(active);
      }
    }

    function commit() {
      ticking = false;

      if (phone.matches) {
        // Clamp before differencing: iOS rubber-banding reports negative
        // scrollY and overscroll past the bottom.
        const y = Math.max(window.scrollY, 0);
        const dy = y - lastY;
        if (y <= TOP_ZONE) pillShown = false;
        else if (dy > DELTA) pillShown = true;
        else if (dy < -DELTA) pillShown = false;
        // Only settle lastY once the deadzone is cleared, so DELTA
        // accumulates across frames instead of being reset by every 1px tick.
        if (Math.abs(dy) > DELTA) lastY = y;
        // Snapped here, but CSS transitions the swap under 680px — see
        // the media query in globals.css.
        setP(pillShown ? 1 : 0);
        return;
      }

      let p = Math.min(Math.max(window.scrollY / DISTANCE, 0), 1);
      // Respect reduced motion by snapping rather than interpolating —
      // still reversible on the way back up.
      if (reduceMotion) p = p > 0.5 ? 1 : 0;
      setP(p);
    }
    function onScroll() {
      if (!ticking) {
        window.requestAnimationFrame(commit);
        ticking = true;
      }
    }
    // Crossing the breakpoint swaps models entirely, so re-seed from the
    // current position rather than leaving a stale value behind.
    function onBreakpoint() {
      lastY = Math.max(window.scrollY, 0);
      pillShown = lastY > TOP_ZONE;
      commit();
    }
    // Seeded through onScroll (rAF), not commit() directly: a synchronous
    // commit here would setState inside the effect body.
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    phone.addEventListener("change", onBreakpoint);
    return () => {
      window.removeEventListener("scroll", onScroll);
      phone.removeEventListener("change", onBreakpoint);
      root.style.setProperty("--nav-p", "0");
    };
  }, [isHome]);

  // Over-the-hero state: bare bar, white on photo, no logo. Everything
  // visual about this is interpolated in CSS; this boolean only drives
  // the things that must be discrete (focusability, hit-testing).
  const overHero = isHome && !pillActive;
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

  // Public endpoint, no credentials -- the same data the product pages render.
  function openSearch() {
    setSearchOpen(true);
    if (catalogRequested.current) return;
    catalogRequested.current = true;
    const baseUrl = apiBaseUrl();
    if (!baseUrl) return;
    setCatalogLoading(true);
    fetch(`${baseUrl}/api/products?limit=200`, { headers: { Accept: "application/json" } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data)) setCatalog((data as BackendProduct[]).map(adaptProduct));
      })
      .catch(() => {
        // Leave `catalog` null so the overlay keeps using the bundled
        // catalogue -- stale beats a search box that returns nothing.
      })
      .finally(() => setCatalogLoading(false));
  }

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
    <header
      className={`z-50 ${
        isHome ? "nav-morph fixed inset-x-0 top-0" : "relative border-b border-ink/10 bg-paper"
      }`}
    >
      {announcement.enabled && (
        <div
          className={`overflow-hidden bg-teal py-1.5 text-white ${isHome ? "nav-morph-announce" : ""}`}
          aria-label="Announcements"
        >
          <div className="animate-marquee flex w-max gap-12 whitespace-nowrap text-[11px] uppercase tracking-[0.18em]">
            {[...announcement.messages, ...announcement.messages].map((message, index) => (
              <span key={index} className="flex items-center gap-12">
                {message} <span aria-hidden className="text-gold">✿</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* gap-3 at base, not gap-6: at 320px the logo (48px tall × 3.2 aspect
          = 154px) plus the menu button plus the three icons overflowed the
          288px content box and clipped the cart icon off-screen.
          On the homepage this row is also the pill itself — nav-morph-inner
          grows its radius/frost/shadow as --nav-p goes 0→1. */}
      <div
        className={`mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:gap-6 sm:px-6 ${
          isHome ? "nav-morph-inner" : ""
        }`}
      >
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setMobileOpen(true)}
          className={`lg:hidden ${isHome ? "nav-morph-ink" : "text-ink"}`}
        >
          <MenuIcon />
        </button>

        {/* The landing spot for the hero's oversized mark: it scales and
            fades in here as the hero's own copy shrinks away (see
            .nav-morph-logo / .hero-masthead in globals.css). Not focusable
            or announced while it's still invisible over the hero — the
            hero's mark carries the branding at that point. */}
        <Link
          href="/"
          className={`shrink-0 ${isHome ? "nav-morph-logo" : ""} ${
            overHero ? "pointer-events-none" : ""
          }`}
          aria-label={brand.name}
          aria-hidden={overHero}
          tabIndex={overHero ? -1 : undefined}
        >
          <Image
            src={brand.logo.src}
            alt={brand.logo.alt}
            width={brand.logo.width}
            height={brand.logo.height}
            priority
            className="h-10 w-auto max-w-none sm:h-12 lg:h-16"
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
                className={`text-[13px] uppercase tracking-[0.14em] ${
                  item.label === "Sale"
                    ? isHome
                      ? "nav-morph-sale transition-opacity hover:opacity-70"
                      : "text-sale"
                    : isHome
                      ? "nav-morph-ink transition-opacity hover:opacity-70"
                      : "text-ink transition-colors hover:text-teal"
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

        <div className="flex shrink-0 items-center gap-3 sm:gap-4">
          <button
            type="button"
            aria-label="Search"
            onClick={openSearch}
            className={
              isHome
                ? "nav-morph-ink transition-opacity hover:opacity-70"
                : "text-ink transition-colors hover:text-teal"
            }
          >
            <SearchIcon />
          </button>
          <Link
            href={accountHref}
            aria-label={user ? "Account" : "Sign in"}
            className={
              isHome
                ? "nav-morph-ink transition-opacity hover:opacity-70"
                : "text-ink transition-colors hover:text-teal"
            }
          >
            <AccountIcon />
          </Link>
          <button
            type="button"
            aria-label={`Cart, ${itemCount} items`}
            onClick={openCart}
            className={`relative ${
              isHome
                ? "nav-morph-ink transition-opacity hover:opacity-70"
                : "text-ink transition-colors hover:text-teal"
            }`}
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
      {searchOpen && (
        <SearchOverlay
          catalog={catalog}
          isCatalogLoading={catalogLoading}
          onClose={() => setSearchOpen(false)}
        />
      )}
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
