# Build Prompt: Luxury Hair Accessories E-Commerce Site (FranceLuxe-style)

Use this prompt to brief an AI/dev to build a site similar in structure to franceluxe.com/collections/hair-accessories.

---

**Prompt:**

Build a luxury hair-accessories e-commerce storefront selling multiple in-house/owned brands (e.g. two vendor lines) — hair ties, barrettes, claw clips, headbands, hair pins/combs, plus adjacent bath/body and gift-card products. Target stack: Shopify (native, given facet complexity) or headless commerce (Shopify Storefront API) + Next.js/Remix frontend with server-driven faceted search.

## Information Architecture
Top nav, 6 sections, mega-menu dropdowns with promo image tiles on the right:
1. **New** — New Arrivals, Trending (For Thick Hair, For Fine Hair, Grab & Go Ponies, Hair Bows, Bridal)
2. **Bestsellers** — split by vendor/brand sub-columns
3. **Hair Accessories** (primary category) — Ponytails (Hair Ties, Scrunchies, Decorative Ponies, Pony Cuffs), Barrettes (Classic French, Mini & Small, Large), Hair Clips (Claw, Small, Large, Banana, Pinch), Headbands (Skinny, Wide, Padded, Silk, Top Knot, Bandeaus & Wraps), Hair Pins & Combs (Bobby Pins, Sticks, Chignon Pins, Decorative Combs, Slides)
4. **Home & Body** — Hair Care, Home (Bath & Spa, Cleaners, Laundry)
5. **Brands** — filter by vendor, split Hair vs Home lines
6. **Sale** — mirrors main taxonomy, sale-only filtered views

Header: announcement bar (free-shipping threshold), logo, search, login, cart. Every mega-menu column pairs text links with 1-2 square promo image tiles (280x280) linking to featured collections/products.

## Collection/Listing Page (core template — reuse everywhere)
- Breadcrumb (Home / Category)
- H1 + long-form SEO description (truncated with "Read more" expander)
- **Filter sidebar** with faceted search, each option shows a live count:
  - Brand/Vendor
  - Product Type (Hair Tie, Clip, Barrette, Headband, Pin, Comb, Jewelry, etc.)
  - Color (large swatch list, 80-150+ named color options)
  - Price (min/max numeric range)
  - Size
  - Material (Cellulose Acetate, Metal, Crystal, Faux Pearl, Elastic, etc.)
- Sort dropdown: Featured, Most Relevant, Best Selling, A-Z/Z-A, Price asc/desc, Date asc/desc
- Product grid, each card:
  - Primary image + hover-swap alternate image (often lifestyle/model shot)
  - Inline "Toggle swatches" control to preview color variants without leaving grid
  - Vendor name (linked, filterable)
  - Product title (linked)
  - Price block: original price struck through + current/sale price when discounted; shows as a *range* when variant prices differ; "Sale" badge
  - Truncated auto-description snippet
  - "View full details" CTA (goes to PDP)
- Trust badge module: "100% Guaranteed" reassurance strip near filters

## Brand Voice / Positioning
- Premium/luxury positioning within an affordable range ($4-$30 typical), multi-brand-under-one-roof model (owned brands, not third-party marketplace)
- Emphasis on hair-type targeting (thick vs fine hair) as a merchandising axis, not just product type
- Frequent "Grab & Go" naming convention, bundle-pack framing (8-pack, 12-pack) as core SKU structure

## Non-Functional Notes
- USD currency, cents shown ($X.XX)
- Faceted nav needs to be fast — precompute counts, use Shopify's native filter/predictive search or an equivalent (Algolia/Search & Discovery) rather than client-side filtering given catalog size (500+ SKUs)
- Swatch-toggle-on-card requires variant image mapping per color at the card level (not just PDP)
- "Read more" collapsible SEO copy pattern on every collection page

## Suggested build order
1. Scaffold storefront skeleton (header w/ mega-menu, announcement bar, cart, footer)
2. Data model: Product (vendor, type, variants[{color, size, material, price, image}], description), Collection (facet config, SEO copy)
3. Faceted collection/listing template (filters + sort + grid) — build once, reuse for every category/vendor/sale view
4. Product card component with swatch-toggle and price-range logic
5. PDP (not sampled this pass — recommend a follow-up scrape of one product page for gallery/variant-picker/description-accordion structure, mirroring the Accessorize PDP pattern already documented)
6. Sale-mirroring: generate `/collections/x-on-sale` variants automatically from base collections rather than hand-maintaining

---

*Derived from a scrape of franceluxe.com/collections/hair-accessories only (nav + one listing page). PDP not sampled — recommend scraping one product page before finalizing PDP spec. Structural/functional blueprint only — do not reuse France Luxe's copy, images, or branding verbatim.*
