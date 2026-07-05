# Graph Report - .  (2026-07-05)

## Corpus Check
- Corpus is ~20,843 words - fits in a single context window. You may not need a graph.

## Summary
- 68 nodes · 111 edges · 8 communities
- Extraction: 79% EXTRACTED · 20% INFERRED · 1% AMBIGUOUS · INFERRED: 22 edges (avg confidence: 0.81)
- Token cost: 0 input · 245,704 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Faceted Search & Mega-Menu (FranceLuxe)|Faceted Search & Mega-Menu (FranceLuxe)]]
- [[_COMMUNITY_Product Page Trust & Accordion (ZaraAccessorize)|Product Page Trust & Accordion (Zara/Accessorize)]]
- [[_COMMUNITY_Brand Story & SEO Content|Brand Story & SEO Content]]
- [[_COMMUNITY_Homepage Hero & Cart Drawer|Homepage Hero & Cart Drawer]]
- [[_COMMUNITY_Product Grid & Card Patterns|Product Grid & Card Patterns]]
- [[_COMMUNITY_Zara Technical Quirks (bot-protection, routing)|Zara Technical Quirks (bot-protection, routing)]]
- [[_COMMUNITY_Flash-Sale Pricing & Discount Merchandising|Flash-Sale Pricing & Discount Merchandising]]
- [[_COMMUNITY_Info Pages & Cookie Consent|Info Pages & Cookie Consent]]

## God Nodes (most connected - your core abstractions)
1. `Accessorize-style Build Prompt (Site Blueprint)` - 12 edges
2. `Zara-style Build Prompt (Site Blueprint)` - 10 edges
3. `Price Block Pattern (strikethrough MRP + sale price, shared)` - 9 edges
4. `FranceLuxe-style Build Prompt (Site Blueprint)` - 9 edges
5. `Accessorize Homepage` - 8 edges
6. `Product Card Pattern (shared)` - 7 edges
7. `FranceLuxe Hair Accessories Collection Page` - 7 edges
8. `Accessorize Bags Collection Page` - 6 edges
9. `SEO Footer/Long-Form Content Block Pattern` - 5 edges
10. `Faceted Search / Filter Sidebar Pattern (shared)` - 5 edges

## Surprising Connections (you probably didn't know these)
- `Color Variant Selector with SKU/Ref Code` --semantically_similar_to--> `Swatch-Toggle-On-Card Color Preview Pattern`  [INFERRED] [semantically similar]
  zara_product.md → fl_build_prompt.md
- `SEO Footer/Long-Form Content Block Pattern` --semantically_similar_to--> `Read-More Collapsible SEO Copy Pattern`  [INFERRED] [semantically similar]
  build_prompt.md → fl_build_prompt.md
- `SEO Footer/Long-Form Content Block Pattern` --conceptually_related_to--> `Editorial/Styled Photography (vs. flat product shots)`  [AMBIGUOUS]
  build_prompt.md → zara_build_prompt.md
- `Storewide Flash-Sale Pricing (uniform ~40-42% off campaign)` --semantically_similar_to--> `Flash-Sale / MRP-vs-Sale Discount Merchandising Pattern`  [INFERRED] [semantically similar]
  zara_product.md → build_prompt.md
- `Trust Badge Module (100% Guaranteed)` --semantically_similar_to--> `Trust Badge Row (Premium Quality/Fast Shipping/Easy Return/Secure Checkout)`  [INFERRED] [semantically similar]
  fl_build_prompt.md → product_bag2.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Product Card Pattern shared across all three sites** — product_card_pattern_shared, home_new_in_grid, fl_collection_product_grid, zara_masonry_editorial_grid [INFERRED 0.85]
- **Price Block (strikethrough + sale price) shared across all three sites** — price_block_pattern_shared, product_bag2_price_block, fl_collection_product_grid, zara_accessories_sale_listing_page [INFERRED 0.85]
- **Mega-Menu Navigation shared across Accessorize and France Luxe (Zara divergent, hidden nav)** — mega_menu_pattern_shared, home_mega_menu, fl_collection_mega_menu [INFERRED 0.85]

## Communities (8 total, 0 thin omitted)

### Community 0 - "Faceted Search & Mega-Menu (FranceLuxe)"
Cohesion: 0.19
Nodes (13): Bags Collection Filter Sidebar (Colour/Price/Occasion/Type), Accessorize Bags Collection Page, Pagination (numbered pages), Sort Dropdown (Featured/Best Selling/Price/Date), Faceted Search / Filter Sidebar Pattern (shared), Large Named-Color Facet List (80-150+ options), FranceLuxe Hair Accessories Collection Page, Material Facet (Cellulose Acetate/Crystal/Metal/etc.) (+5 more)

### Community 1 - "Product Page Trust & Accordion (Zara/Accessorize)"
Cohesion: 0.27
Nodes (11): PDP Accordion Sections Pattern (shared), PDP Accordions (Description/Details/More Information), Accessorize PDP: Black Fringe Shoulder Bag, PDP Price Block (Regular price + strikethrough MRP + % off), You May Also Like Related Products Rail, Trust Badge Row (Premium Quality/Fast Shipping/Easy Return/Secure Checkout), Accessorize PDP: Brown Alex Classic Structured Tote Bag, Trust Badge Module (100% Guaranteed) (+3 more)

### Community 2 - "Brand Story & SEO Content"
Cohesion: 0.22
Nodes (9): Accessorize Brand Story (est. 1984), Accessorize Five-Star In-Store Experience, Accessorize Sustainability Commitment, Accessorize London (Brand), Footer Internal-Link Farm (Shop By Bags/Jewellery/Hair), Accessorize SEO Content Block + Category Blurbs + FAQ, Read-More Collapsible SEO Copy Pattern, SEO Footer/Long-Form Content Block Pattern (+1 more)

### Community 3 - "Homepage Hero & Cart Drawer"
Cohesion: 0.25
Nodes (8): Lifestyle/Editorial Tile Grid Section, Homepage Hero Banner + Promo Tiles Section, Cart Slide-Out Drawer Pattern (shared), Accessorize Cart Drawer (empty state, category shortcuts), Editorial Tiles (Everyday Carry / Wear Anywhere / Sunny Side), Accessorize Hero Banner (Further Reduction campaign), Accessorize Homepage, Add to Cart / Buy It Now CTA Buttons

### Community 4 - "Product Grid & Card Patterns"
Cohesion: 0.39
Nodes (8): FranceLuxe-style Build Prompt (Site Blueprint), Multi-Brand-Under-One-Roof Merchandising Model, FranceLuxe Product Grid with Toggle Swatches, New In Product Grid (hover-swap image, NEW/Sale badge), Product Card Pattern (shared), Swatch-Toggle-On-Card Color Preview Pattern, Masonry/Staggered Editorial Product Grid, Sparse Grid / Richness-Lives-on-PDP Design Rationale

### Community 5 - "Zara Technical Quirks (bot-protection, routing)"
Cohesion: 0.29
Nodes (7): Bot-Protection Interstitial Page (Cloudflare/PerimeterX-style), Zara (Brand), Zara-style Build Prompt (Site Blueprint), Zara Raw Interstitial HTML (plain GET blocked), Region/Locale-Aware Routing (/in/en/, regionGroupId), Stealth-Fetch Scrape Technique for Zara, VIEW Density Toggle (1/2/3-column grid switch)

### Community 6 - "Flash-Sale Pricing & Discount Merchandising"
Cohesion: 0.47
Nodes (6): Accessorize-style Build Prompt (Site Blueprint), Product/Collection Data Model, Flash-Sale / MRP-vs-Sale Discount Merchandising Pattern, Price Block Pattern (strikethrough MRP + sale price, shared), Zara Women's Accessories SALE Listing Page, Storewide Flash-Sale Pricing (uniform ~40-42% off campaign)

### Community 7 - "Info Pages & Cookie Consent"
Cohesion: 0.33
Nodes (6): Contact Form (Name/Email/Phone/Message + hCaptcha), Accessorize Contact Us Page, Cookie Consent Banner Pattern (shared), Accessorize FAQ Page, Accessorize Return/Refund Policy (15 days, Rs.300 charge), Accessorize Cookie Consent Banner

## Ambiguous Edges - Review These
- `SEO Footer/Long-Form Content Block Pattern` → `Editorial/Styled Photography (vs. flat product shots)`  [AMBIGUOUS]
  zara_build_prompt.md · relation: conceptually_related_to

## Knowledge Gaps
- **10 isolated node(s):** `Accessorize Five-Star In-Store Experience`, `Product/Collection Data Model`, `Sort Dropdown (Featured/Best Selling/Price/Date)`, `Pagination (numbered pages)`, `Accessorize Return/Refund Policy (15 days, Rs.300 charge)` (+5 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `SEO Footer/Long-Form Content Block Pattern` and `Editorial/Styled Photography (vs. flat product shots)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `Accessorize-style Build Prompt (Site Blueprint)` connect `Flash-Sale Pricing & Discount Merchandising` to `Faceted Search & Mega-Menu (FranceLuxe)`, `Product Page Trust & Accordion (Zara/Accessorize)`, `Brand Story & SEO Content`, `Homepage Hero & Cart Drawer`, `Product Grid & Card Patterns`, `Info Pages & Cookie Consent`?**
  _High betweenness centrality (0.397) - this node is a cross-community bridge._
- **Why does `Price Block Pattern (strikethrough MRP + sale price, shared)` connect `Flash-Sale Pricing & Discount Merchandising` to `Faceted Search & Mega-Menu (FranceLuxe)`, `Product Page Trust & Accordion (Zara/Accessorize)`, `Product Grid & Card Patterns`, `Zara Technical Quirks (bot-protection, routing)`?**
  _High betweenness centrality (0.272) - this node is a cross-community bridge._
- **Why does `Zara-style Build Prompt (Site Blueprint)` connect `Zara Technical Quirks (bot-protection, routing)` to `Product Page Trust & Accordion (Zara/Accessorize)`, `Brand Story & SEO Content`, `Product Grid & Card Patterns`, `Flash-Sale Pricing & Discount Merchandising`?**
  _High betweenness centrality (0.228) - this node is a cross-community bridge._
- **What connects `Accessorize Five-Star In-Store Experience`, `Product/Collection Data Model`, `Sort Dropdown (Featured/Best Selling/Price/Date)` to the rest of the system?**
  _11 weakly-connected nodes found - possible documentation gaps or missing edges._