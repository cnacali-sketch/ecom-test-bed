# Build Prompt: Fashion Accessories E-Commerce Site (Accessorize-style)

Use this prompt to brief an AI/dev to build a site similar in structure to accessorizelondon.in.

---

**Prompt:**

Build a women's fashion accessories e-commerce storefront (bags, jewellery, hair accessories, sunglasses/scarves, kids accessories). Target stack: headless commerce (Shopify Storefront API, or Medusa/Saleor) + Next.js/Remix frontend, or plain Shopify theme (Liquid) if speed matters more than customization.

## Information Architecture
Top nav with 6 primary sections, each a mega-menu flyout (thumbnail image + subcategory list):
1. **New In** — Shop All, Bags, Jewellery, Accessories, Kids
2. **Bags** — Totes, Sling bags, Shoulder Bags, Handheld/Satchel, Nylon Bags, Phone Bags, Backpacks, Clutches, Wallets, Pouches, Shoppers/Weekenders, Bag Charms
3. **Jewellery** — Bestsellers, Gold Plated, Waterproof, Sterling Silver; sub-nav per type: Earrings (Studs/Hoops/Drop/Statement/Multi-packs), Necklaces (Layered/Pendants/Chains/Statement/Charms/Cord), Bracelets (Cuffs/Charms/Stretch), Rings (Stacking/Statement), Anklets
4. **Accessories** — Hair Accessories, Cardholders, Sunglasses, Scarves, Hats, Stationery, Travel, Pouches
5. **Kids** — Bags, Hair, Jewellery, Stationery, Hats & Scarves, Sunglasses
6. **Sale** — by category, by price band (under 999/1599/2499), by offer

Footer nav: Company Info (Store Locator, About Us, Blog), Customer Services (Track Order, Returns & Exchanges, FAQ, Contact, T&C), Legal (Shipping/Refund/Privacy/Terms), social links, newsletter signup with double opt-in and cookie-consent banner (hCaptcha on forms).

## Header/Global Chrome
- Logo left/center, search icon (overlay/modal search), account link, cart icon with live item-count badge
- Cart is a slide-out drawer: shows line items, subtotal, free-shipping note, checkout CTA, plus category shortcut chips when empty ("Your Cart is Empty" state with quick links to New In/Best Sellers/etc.)
- Cookie consent banner (accept/decline/manage preferences)

## Homepage Sections (in order)
1. Hero banner — seasonal campaign creative + CTA (e.g. "Further Reduction — Over 100 New Lines Added")
2. Quick promo CTA row (3-4 tiles: Clearance Sale, Gifts, Shop Jewellery, Shop All)
3. "New In" product grid — cards with: image (hover-swap second image), NEW/Sale badge, product name, sale price + strikethrough MRP, "Add to cart" button inline on card
4. Lifestyle/editorial tile grid (2-3 tiles): themed banners linking to curated collections (e.g. "Everyday Carry" → Bags, "Wear Anywhere" → Waterproof Jewellery, "Sunny Side" → Sunglasses)
5. Two large full-width promo banners (gifting/personalization theme, hair-accessories theme)
6. SEO/brand content block: brand story paragraph, per-category descriptive blurbs (Bags/Sunglasses/Scarves/Jewellery/Hair/Kids), FAQ accordion, internal-link footer lists grouped by product type (for SEO)
7. Footer

## Category/Collection Listing Page
- Filter/sort sidebar (implied — price, category refinements)
- Responsive product grid, each card: primary image + hover alt image, product name, current price, strikethrough MRP, "Sold Out" badge overriding price/CTA when out of stock

## Product Detail Page
- Image gallery (multiple images, zoom-capable)
- Title, current price + MRP + implied discount
- "Add to cart" (primary) + "Buy it now" (secondary) CTAs
- Accordions: Description, Care Instructions, SKU/More Information
- Customer care contact block (support email + phone)
- (Recommend adding) related/cross-sell product carousel

## Brand Voice / Positioning
- Affordable, stackable, everyday fashion accessories; heritage brand (est. 1984); tone: confident, approachable, "complete every outfit with panache"
- Price point: mid-range (₹1,000–₹8,000 typical for bags), frequent MRP-vs-sale-price display to emphasize discount

## Non-Functional Notes
- INR currency formatting (₹ with comma thousands separators)
- Strong internal-linking/SEO footer content per category — important for organic traffic
- Newsletter capture + social proof (Instagram/Facebook/YouTube) in footer
- Mobile-first: mega-menu should collapse to accordion-style nav ("+" expanders seen on mobile markup)

## Suggested build order
1. Scaffold storefront skeleton (header, footer, cart drawer, routing for `/`, `/collections/:handle`, `/products/:handle`, `/pages/:handle`)
2. Data model: Product (name, price, mrp, sku, description, care_instructions, images[], status), Collection (name, handle, products[])
3. Homepage sections as composable, CMS-driven blocks (banners/copy swappable without redeploy)
4. Category grid + PDP with cart drawer wired to a cart/session store
5. Static info pages (About, FAQ, Contact, policies) from CMS/markdown
6. SEO content blocks + footer link farm per category

---

*Derived from a bounded scrape of accessorizelondon.in (homepage, 1 category page, 2 product pages, about/faq/contact) — see `scraped_data.json` for raw structural reference. This is a structural/functional blueprint, not a verbatim copy — do not reuse Accessorize's proprietary copy, images, or branding.*
