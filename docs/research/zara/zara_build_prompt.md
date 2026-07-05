# Build Prompt: Fast-Fashion Accessories E-Commerce Site (Zara-style)

Use this prompt to brief an AI/dev to build a site similar in structure to zara.com's women's accessories sale listing.

---

**Prompt:**

Build a minimalist, editorial-style fast-fashion accessories storefront (gloves, scarves, belts, jewelry, bags, hats). Target stack: custom React/Next.js SPA (this is NOT a Shopify theme — Zara runs a bespoke headless frontend), with server-rendered product data behind a JSON API, region/locale-aware routing (`/in/en/...`), and CSR-heavy rendering that requires a real browser to view (aggressive bot-protection interstitial on non-browser requests).

## Information Architecture
- Minimal top header: Search, Bag (count badge), Log In, Help — no visible mega-menu in this view (nav likely lives in a separate hamburger/left-rail drawer not captured in this scrape)
- Listing page controls: **Filters** button (opens facet panel) + **VIEW** density toggle (1/2/3-column grid switch)
- URL pattern encodes category + list id + variant params: `/s-woman-accessories-l8599.html?v1=<id>&regionGroupId=<region>`

## Listing Page Layout
- Staggered/masonry grid, editorial-style full-bleed product photography (not flat product-on-white; shows garment worn/styled)
- Card = image + uppercase title (link) + price block only — no swatches, no "add to cart" on card, no ratings/reviews shown
- Price block pattern: strikethrough original price → discount % → sale price (all sale items in this set showed a uniform ~40-42% off, suggesting a storewide flash-sale campaign rather than per-item pricing)
- "MRP incl. of all taxes" disclaimer near price (India-specific tax transparency requirement)
- Page title dynamically reflects filter state, e.g. "View All Women's Accessories - SALE | ZARA India"

## Product Detail Page
- Single large hero editorial photo (styled/worn shot), not a boxed product-grid gallery
- Title (uppercase) + price block (same original/discount/sale pattern + tax disclaimer)
- Color variant selector (swatch list, e.g. "Burgundy", "Chocolate")
- Internal SKU/ref code shown next to selected color (e.g. "Burgundy 3920/045/605")
- "Put it in your basket" section: Add-to-bag button
- Styling context line: "Model height: 178 cm"
- Short 1-2 sentence description (fabric/construction focused, minimal marketing copy)
- Special-conditions notice for restricted-return categories (e.g. gloves, underwear)
- **"Complete your look"** cross-sell rail — shows 1+ complementary items to build an outfit
- Accordion sections below the fold: Product Measurements, Composition/Care & Origin, Check In-Store Availability, Shipping/Exchanges/Returns

## Brand Voice / Positioning
- Minimal copywriting, fabric/construction-first descriptions, no lifestyle SEO blurbs (contrast with Accessorize's long-form SEO content blocks)
- Editorial/fashion photography over flat product shots — implies need for a real photo studio pipeline, not just e-comm product shots
- Uniform flash-sale-style discounting across a whole category (merchandising signal: time-boxed campaign pricing, not per-SKU clearance)

## Non-Functional / Technical Notes
- **Bot protection**: plain HTTP GET returns an interstitial iframe (`/interstitial/ic.html`) instead of content — requires real browser rendering (headless Chromium w/ stealth, network-idle wait) to get actual HTML. Budget for this if scraping/monitoring competitor pricing; budget for equivalent protection (Cloudflare/, PerimeterX-style challenge) if replicating.
- Region/locale is a first-class routing concern (`/in/en/`, `regionGroupId` param) — build with i18n/multi-region routing from day one, not bolted on later
- No visible reviews/ratings, no "toggle swatches on card" (contrast with FranceLuxe) — Zara keeps the grid deliberately sparse; richness lives on the PDP

## Suggested build order
1. Region-aware routing skeleton (`/[country]/[lang]/...`) + minimal header (search/bag/login/help)
2. Editorial-grid listing template: masonry layout, density toggle, filter drawer (facets not captured this pass — recommend opening the Filters panel in a follow-up scrape)
3. PDP template: hero image, price block w/ discount logic, variant selector, accordions, cross-sell rail
4. Pricing engine supporting storewide campaign discounts (% off applied at campaign level, not per-SKU override)
5. Bot-resistant infra if this is a real storefront at scale (rate limiting, challenge pages) — mirror only if authorized/your own site

---

*Derived from a stealth-fetch scrape of one listing page + one product page (zara.com/in/en). Filters panel and full nav drawer not opened/sampled — recommend a follow-up pass if those are needed. Structural/functional blueprint only — do not reuse Zara's copy, photography, or branding verbatim.*
