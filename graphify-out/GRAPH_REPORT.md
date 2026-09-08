# Graph Report - ecom-test-bed  (2026-09-08)

## Corpus Check
- 43 files · ~169,205 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2117 nodes · 4178 edges · 141 communities (96 shown, 13 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 159 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Auth Tokens & Tests
- Order API Tests
- Account & Admin Pages
- Caveman Skill (agents)
- Caveman Skill (claude)
- Orders & Razorpay Payments
- Backend Config & Celery
- Security & Token Service
- Admin UI Screens
- Pricing Calculations
- Analytics & Fraud Events
- Frontend Dependencies
- Database Models
- Storefront Product UI
- Inventory & SKUs
- Account & Verification UI
- Async DB Engine
- User Model
- Coupons API
- Barcode Generation
- Auth Login Flow
- TypeScript Config
- Order Models
- Media Uploads
- Auth Profile Endpoints
- Product API Tests
- Root Layout & Chrome
- Products API
- Coupon API Tests
- Categories
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 67
- Community 68
- Community 69
- Community 70
- Community 71
- Community 72
- Community 73
- Community 74
- Community 75
- Community 76
- Community 77
- Community 78
- Community 79
- Community 80
- Community 81
- Community 82
- Community 83
- Community 84
- Community 85
- Community 86
- Community 87
- Community 88
- Community 89
- Community 90
- Community 91
- Community 92
- Community 93
- Community 94
- Community 118
- Community 119
- Community 120
- Community 121
- Community 122
- Community 123
- Community 124
- Community 125
- Community 129
- Community 131
- Community 136
- Community 137
- Community 138
- Community 139

## God Nodes (most connected - your core abstractions)
1. `apiFetch()` - 54 edges
2. `get_settings()` - 46 edges
3. `User` - 42 edges
4. `Base` - 38 edges
5. `SiteConfig` - 23 edges
6. `analyze_description()` - 21 edges
7. `decode_token()` - 20 edges
8. `useAuth()` - 20 edges
9. `hash_password()` - 19 edges
10. `TokenError` - 18 edges

## Surprising Connections (you probably didn't know these)
- `Podman Desktop chosen over Docker Desktop for local infra (OSI-open-source license requirement)` --rationale_for--> `docker-compose.yml (Postgres/Redis/RabbitMQ/backend/frontend/Caddy)`  [EXTRACTED]
  README.md → docker-compose.yml
- `backend service (built from ./backend)` --shares_data_with--> `Backend Python dependency manifest (requirements.txt)`  [INFERRED]
  docker-compose.yml → backend/requirements.txt
- `Project roadmap (Phase 1 calculators, Phase 2 eval dashboard, Phase 3 ops tooling, Later: LLM agents/Celery)` --conceptually_related_to--> `FastAPI/SQLAlchemy/asyncpg/Celery core backend stack`  [INFERRED]
  README.md → backend/requirements.txt
- `Savvy In Teal — E-Commerce Test Bed README` --conceptually_related_to--> `frontend/README.md (create-next-app default)`  [INFERRED]
  README.md → frontend/README.md
- `Caveman Help — Quick Reference Card` --references--> `caveman-help skill instructions (modes, skills table, config)`  [EXTRACTED]
  .agents/skills/caveman-help/SKILL.md → .claude/skills/caveman-help/SKILL.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Locate to Fix to Verify subagent pipeline** — claude_skills_cavecrew_skill_cavecrew_investigator, claude_skills_cavecrew_skill_cavecrew_builder, claude_skills_cavecrew_skill_cavecrew_reviewer [EXTRACTED 1.00]
- **Locate → Fix → Verify Delegation Chain** — agents_agents_cavecrew_investigator, agents_agents_cavecrew_builder, agents_agents_cavecrew_reviewer [EXTRACTED 1.00]
- **Ponytail Over-Engineering Reduction Toolkit** — agents_skills_ponytail_skill, agents_skills_ponytail_review_skill, agents_skills_ponytail_audit_skill, agents_skills_ponytail_debt_skill [EXTRACTED 1.00]
- **Automation Features** — post-commit-hook, claude-md-integration, watch-mode [EXTRACTED 1.00]
- **Confidence Levels** — extracted-confidence, inferred-confidence, ambiguous-confidence [EXTRACTED 1.00]
- **Export Formats** — export-format-html, export-format-json, export-format-graphml, export-format-neo4j, export-format-falkordb, export-format-svg, export-format-wiki [EXTRACTED 1.00]
- **Extraction Pipeline** — corpus-detection, semantic-extraction, ast-extraction, clustering [EXTRACTED 1.00]
- **File Types** — code-files, document-files, paper-files, image-files, video-files [EXTRACTED 1.00]
- **Knowledge Graph Structure** — graph-node, graph-edge, hyperedge [EXTRACTED 1.00]
- **Query Operations** — graph-query, graph-path, graph-explain [EXTRACTED 1.00]
- **Traversal Modes** — bfs-traversal [EXTRACTED 1.00]
- **Simplicity-first / anti-speculative-generality design philosophy shared across skills** — claude_skills_ponytail_skill_yagni, claude_skills_ponytail_skill_the_ladder, claude_skills_karpathy_skill_no_speculative_generality [INFERRED 0.80]
- **Auto-Clarity terseness-override pattern replicated across caveman-family skills** — claude_skills_caveman_skill_auto_clarity, claude_skills_caveman_review_skill_auto_clarity, claude_skills_caveman_commit_skill_auto_clarity [INFERRED 0.85]
- **Auto-Clarity Safety Override Shared Across Caveman Skills** — agents_skills_caveman_skill_auto_clarity, agents_skills_caveman_commit_skill, agents_skills_caveman_review_skill, agents_skills_cavecrew_skill [INFERRED 0.85]
- **docs/EDITING.md, frontend/AGENTS.md and frontend/CLAUDE.md form one governance chain for storefront content-editing agent rules** — docs_editing_ai_editing_rules, frontend_agents_storefront_rules, frontend_claude_include_directive [INFERRED 0.85]
- **Savvy In Teal brand identity mark composition** — savvy_in_teal_wordmark_concept, frontend_public_brand_logo_sm_gold_script_typography, frontend_public_brand_logo_sm_floral_watercolor_illustration, frontend_public_brand_logo_sm_color_palette [INFERRED 0.85]
- **Accessorize, FranceLuxe and Zara storefront blueprints jointly inform Savvy In Teal's synthesized design direction** — docs_research_accessorize_build_prompt, docs_research_franceluxe_fl_build_prompt, docs_research_zara_zara_build_prompt [INFERRED 0.90]

## Communities (141 total, 13 thin omitted)

### Community 0 - "Auth Tokens & Tests"
Cohesion: 0.07
Nodes (70): One issued refresh token. Rotated on every use., RefreshToken, _no_real_email(), AsyncClient, asyncio, fixture, Tests for /api/auth endpoints, the JWT cookie gate, and refresh rotation., A signup attempt must not overwrite the real owner's password. (+62 more)

### Community 1 - "Order API Tests"
Cohesion: 0.08
Nodes (64): _make_coupon(), _make_tracked_product(), product_id(), AsyncClient, asyncio, AsyncSession, fixture, Tests for /api/orders endpoints. (+56 more)

### Community 2 - "Account & Admin Pages"
Cohesion: 0.06
Nodes (36): AccountView(), AdminLoginPage(), handleLogin(), CheckoutPage(), ForgotPasswordPage(), LoginPage(), handleLogin(), RegisterPage() (+28 more)

### Community 3 - "Caveman Skill (agents)"
Cohesion: 0.06
Nodes (49): benchmark_pair(), count_tokens(), main(), print_table(), Path, main(), print_usage(), backup_dir_for() (+41 more)

### Community 4 - "Caveman Skill (claude)"
Cohesion: 0.06
Nodes (49): benchmark_pair(), count_tokens(), main(), print_table(), Path, main(), print_usage(), backup_dir_for() (+41 more)

### Community 5 - "Orders & Razorpay Payments"
Cohesion: 0.08
Nodes (54): _authoritative_pricing(), create_order(), flag_order(), get_order(), init_razorpay_payment(), list_all_orders(), list_orders(), OrderAdminRead (+46 more)

### Community 6 - "Backend Config & Celery"
Cohesion: 0.06
Nodes (45): Celery application wiring. This only proves the task queue is wired up…, get_settings(), Application configuration loaded from environment variables. Uses pydantic-…, Return CORS origins as a list, split on commas., Return a cached Settings instance (avoids re-parsing env on every call)., Central application settings. All values have safe local-dev defaults so the…, Settings, create_app() (+37 more)

### Community 7 - "Security & Token Service"
Cohesion: 0.09
Nodes (46): create_access_token(), create_refresh_token(), create_reset_token(), _create_token(), create_verify_token(), decode_token(), dummy_verify(), hash_password() (+38 more)

### Community 8 - "Admin UI Screens"
Cohesion: 0.11
Nodes (35): DiscountBadge(), Field(), ShowToggle(), Toggle(), ProductCardPreview(), Dashboard(), EditCell, Inventory() (+27 more)

### Community 9 - "Pricing Calculations"
Cohesion: 0.07
Nodes (25): calculate_break_even(), calculate_markup(), calculate_profit_margin(), post, Pricing calculator endpoints (Pricing Agent tools)., Compute the retail price from cost and desired margin percentage., Compute the profit margin percentage from cost and selling price., Compute the number of units needed to break even on fixed costs. (+17 more)

### Community 10 - "Analytics & Fraud Events"
Cohesion: 0.10
Nodes (40): AdClickFlag, CheckoutVelocityFlag, _classify_browser(), _classify_device(), CouponAbuseFlag, EventCreate, events_summary(), EventSummary (+32 more)

### Community 11 - "Frontend Dependencies"
Cohesion: 0.05
Nodes (41): eslint, eslint-config-next, @fontsource-variable/archivo, @fontsource-variable/fraunces, dependencies, @fontsource-variable/archivo, @fontsource-variable/fraunces, lucide-react (+33 more)

### Community 12 - "Database Models"
Cohesion: 0.08
Nodes (31): Base, Shared declarative base for all ORM models., AgentDecision, AgentDecision ORM model -- audit log of agent input/output pairs., Records what an agent decided, given a specific input, for auditing/eval., Collection, Collection ORM model — the core navigation unit for the storefront. A…, A named grouping of products (e.g. Hair Accessories, Jewellery). (+23 more)

### Community 13 - "Storefront Product UI"
Cohesion: 0.11
Nodes (26): SpecimenRanges(), SpecimenRangesProps, AccordionSection(), AccordionSectionProps, CrossSellRail(), CrossSellRailProps, ImageGallery(), ImageGalleryProps (+18 more)

### Community 14 - "Inventory & SKUs"
Cohesion: 0.08
Nodes (20): generate_barcode(), generate_skus(), post, Response, Inventory generator endpoints (Inventory Agent tools)., Bulk-generate SKUs from a brand/category/size spec., Generate a UPC-A or EAN-13 barcode image, returned as raw PNG or SVG bytes., bulk_generate() (+12 more)

### Community 15 - "Account & Verification UI"
Cohesion: 0.10
Nodes (32): Status, VerifyEmail(), Order, OrderHistory(), submitReturn(), STATUS_LABEL, CategoryManager(), add() (+24 more)

### Community 16 - "Async DB Engine"
Cohesion: 0.09
Nodes (27): AsyncEngine, create_engine(), get_db_session(), AsyncSession, Async SQLAlchemy engine/session setup. The engine is created lazily and is…, Create (but do not connect) the async SQLAlchemy engine., FastAPI dependency yielding an AsyncSession, closed after the request., Authentication dependencies. JWT in an httpOnly cookie is the gate (P1) — it… (+19 more)

### Community 17 - "User Model"
Cohesion: 0.12
Nodes (28): normalize_email(), User ORM model — customers and admins share one table, split by `role`. Two…, An authenticated account. Email is the login identity., Lowercase + strip so `A@B.com ` and `a@b.com` are the same account., User, create_admin(), Create or promote an admin account. Self-registration always creates a customer…, admin_client() (+20 more)

### Community 18 - "Coupons API"
Cohesion: 0.14
Nodes (31): coupon_qr(), CouponCreate, CouponEdit, CouponRead, CouponValidate, CouponValidateResponse, create_coupon(), delete_coupon() (+23 more)

### Community 19 - "Barcode Generation"
Cohesion: 0.11
Nodes (15): compute_ean13_checksum(), generate_ean13(), generate_upca(), UPC-A / EAN-13 barcode generation with PNG + SVG export. Uses the open-source…, Validate that `code` is exactly `expected_length` numeric digits. Raises:…, Compute the EAN-13 checksum digit for a 12-digit code. Odd positions (1st, 3rd,…, Render a `python-barcode` instance to PNG and SVG bytes., Generate an EAN-13 barcode (PNG + SVG) from a 12-digit code. Returns: dict with… (+7 more)

### Community 20 - "Auth Login Flow"
Cohesion: 0.14
Nodes (28): _clear_auth_cookies(), forgot_password(), login(), logout(), AsyncSession, BackgroundTasks, post, Request (+20 more)

### Community 21 - "TypeScript Config"
Cohesion: 0.07
Nodes (28): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+20 more)

### Community 22 - "Order Models"
Cohesion: 0.11
Nodes (25): Order, OrderItem, Order and OrderItem ORM models., A customer order, composed of one or more `OrderItem` rows., A single line item within an `Order`., ReturnRequest ORM model., A customer-initiated request to return a delivered order., ReturnRequest (+17 more)

### Community 23 - "Media Uploads"
Cohesion: 0.11
Nodes (26): delete_media(), list_media(), MediaItem, BaseModel, delete, get, Path, post (+18 more)

### Community 24 - "Auth Profile Endpoints"
Cohesion: 0.12
Nodes (24): me(), get, patch, Authentication endpoints: register, login, refresh, logout, verify-email, me.…, Consume a reset token and set a new password. Revokes every refresh-token…, Return the signed-in account — drives frontend auth state., Customer edits their own profile (name, phone, addresses). Only the fields…, reset_password() (+16 more)

### Community 25 - "Product API Tests"
Cohesion: 0.19
Nodes (26): _create(), AsyncClient, asyncio, Tests for /api/products endpoints. Uses an in-memory SQLite DB via conftest.…, The admin UI sends no variants; the PUT must not wipe them., A caller that only edits price/stock must not wipe attrs it doesn't model., sku is an identity key (used as the storefront product id) — immutable via PUT., test_collection_filter() (+18 more)

### Community 26 - "Root Layout & Chrome"
Cohesion: 0.12
Nodes (18): metadata, RootLayout(), viewport, AddedToast(), CartDrawer(), EMPTY_STATE_SHORTCUTS, Footer(), NewsletterForm() (+10 more)

### Community 27 - "Products API"
Cohesion: 0.15
Nodes (24): Product, A sellable product, grouping one or more `ProductVariant` rows., create_product(), delete_product(), get_product(), get_product_by_slug(), list_products(), AsyncSession (+16 more)

### Community 28 - "Coupon API Tests"
Cohesion: 0.25
Nodes (24): _coupon_payload(), AsyncClient, asyncio, Tests for /api/coupons endpoints., Public and unauthenticated -- without this cap it's a free oracle for brute-…, test_coupon_qr_requires_admin(), test_coupon_qr_returns_png(), test_create_coupon_as_admin() (+16 more)

### Community 29 - "Categories"
Cohesion: 0.16
Nodes (22): Category, Product category ORM model. Distinct from `Collection` (Hair Accessories /…, CategoryCreate, CategoryRead, CategoryUpdate, create_category(), delete_category(), list_categories() (+14 more)

### Community 30 - "Community 30"
Cohesion: 0.12
Nodes (19): HelpTip(), useDnd(), ImageDrop(), upload(), Meta, PARENTS, DEFAULTS, EditorialTile (+11 more)

### Community 31 - "Community 31"
Cohesion: 0.16
Nodes (20): ContactAdminRead, ContactCreate, ContactRead, create_contact_message(), delete_contact_message(), _get_message_or_404(), list_contact_messages(), AsyncSession (+12 more)

### Community 32 - "Community 32"
Cohesion: 0.16
Nodes (21): block_customer(), BlockRequest, CustomerEdit, CustomerRead, delete_customer(), _get_customer_or_404(), list_customers(), AsyncSession (+13 more)

### Community 33 - "Community 33"
Cohesion: 0.12
Nodes (18): Heuristic scoring of product description text for LLM/recommendation readiness.…, Return lowercase word tokens from `text`., Return the Flesch reading ease score, preferring `textstat` if available., _readability_score(), _split_words(), check_keyword_density(), Keyword-density scoring (most-frequent-word ratio)., Score keyword density; return (points_out_of_30, issues, suggestions). (+10 more)

### Community 34 - "Community 34"
Cohesion: 0.26
Nodes (14): HomePage(), CampaignBand(), EditorialTiles(), HeroBanner(), QuickCtaRow(), SeoContentBlock(), Reveal(), RevealProps (+6 more)

### Community 35 - "Community 35"
Cohesion: 0.13
Nodes (11): metadata, metadata, metadata, metadata, NAV_ITEMS, PolicyPage(), PolicyPageProps, PolicySection (+3 more)

### Community 36 - "Community 36"
Cohesion: 0.16
Nodes (6): analyze_description(), Heuristically score a product description's LLM/recommendation readiness.…, Unit tests for app.services.description_analyzer (pure functions, no LLM call)., Covers the self-contained Flesch approximation used when `textstat` (or its…, TestAnalyzeDescription, TestFallbackReadabilityWithoutTextstat

### Community 37 - "Community 37"
Cohesion: 0.11
Nodes (20): Cross-Repo Merge, Directed Graph, FalkorDB Export, GraphML Export, HTML Export, JSON Export, Neo4j Export, SVG Export (+12 more)

### Community 38 - "Community 38"
Cohesion: 0.15
Nodes (16): ActiveFilters, COLOR_HEX_MAP, FacetGroupProps, FilterSidebar(), FilterSidebarProps, buildFacetCounts(), EMPTY_FILTERS, matchesFilters() (+8 more)

### Community 39 - "Community 39"
Cohesion: 0.18
Nodes (18): issue(), purge_expired(), AsyncSession, Exception, UUID, Refresh Token Rotation (RTR) with reuse detection. The rule: a refresh token is…, A refresh token was presented that was already spent, or has no record. Both…, Mint a refresh token and record it. Omit `family_id` to start a session. (+10 more)

### Community 40 - "Community 40"
Cohesion: 0.14
Nodes (19): Blush Pink & Gold Botanical Color Palette, Savvy In Teal brand identity: feminine, romantic, boutique hair-accessories & jewellery aesthetic, Watercolor-style floral bouquet motif (pink peonies, blush roses, white roses, green foliage) overlaid on the wordmark, Logo color palette: gold/black script, blush-pink & white florals, muted green foliage on transparent ground - notably no teal hue despite the brand name, Large ('-lg') logo variant, likely intended for header/hero/high-resolution storefront placements, "Savvy In Teal" gold cursive script wordmark with black outline/drop-shadow, Savvy In Teal logo (large) - gold cursive wordmark with pink/white floral bouquet, Savvy In Teal Logo (Large, WebP) (+11 more)

### Community 41 - "Community 41"
Cohesion: 0.15
Nodes (13): CollectionPage(), CollectionPageProps, ProductPage(), ProductPageProps, ProductDetail(), SeoDescription(), SeoDescriptionProps, adaptCollection() (+5 more)

### Community 42 - "Community 42"
Cohesion: 0.20
Nodes (15): AdminApp(), newDraft(), Analytics(), EventSummary, FUNNEL_STEPS, LocationCount, TopProduct, attrNum() (+7 more)

### Community 43 - "Community 43"
Cohesion: 0.18
Nodes (9): _find_missing(), _get_nested(), inspect_product_schema(), Validates a product dict against schema.org Product JSON-LD guidance. Fields…, Look up a possibly-nested field (e.g. "offers.price") in `product`. Returns…, Return the subset of `fields` that are missing or falsy in `product`., Validate `product` against schema.org Product required/recommended fields.…, Unit tests for app.services.product_schema_inspector (pure functions, no I/O). (+1 more)

### Community 44 - "Community 44"
Cohesion: 0.32
Nodes (17): _make_delivered_order(), _make_tracked_product(), _make_untracked_product(), AsyncClient, asyncio, Tests for /api/returns endpoints., A real product with no stock tracking (attrs.stock unset) — order_items now has…, test_approve_paid_return_refunds_and_restocks() (+9 more)

### Community 45 - "Community 45"
Cohesion: 0.12
Nodes (18): Auto-clarity (inherited from caveman), caveman-commit (terse Conventional Commits generator), Auto-Clarity (always body for breaking changes/security/migrations/reverts), caveman-commit skill instructions, caveman-compress (compress memory files to save tokens), Snyk High Risk rating is a false positive: fixed-arg subprocess (no shell interpolation), file I/O confined to user-specified path with .original.md backup, CLI fallback only without ANTHROPIC_API_KEY, files >500KB rejected pre-API-call, caveman-compress skill instructions (compression rules, process, boundaries), caveman-help skill instructions (modes, skills table, config) (+10 more)

### Community 46 - "Community 46"
Cohesion: 0.14
Nodes (11): Header(), commit(), onBreakpoint(), onScroll(), setP(), HeaderProps, MegaMenu(), MegaMenuColumn (+3 more)

### Community 47 - "Community 47"
Cohesion: 0.19
Nodes (15): CollectionDetail, CollectionRead, get_collection(), list_collections(), AsyncSession, BaseModel, get, List all collections (nav/marketing metadata). (+7 more)

### Community 48 - "Community 48"
Cohesion: 0.34
Nodes (16): _contact_payload(), AsyncClient, asyncio, Tests for /api/contact endpoints., The submitter's own confirmation must not echo back their recorded IP., test_admin_list_still_includes_ip_address(), test_delete_message_as_admin(), test_delete_message_as_customer_403() (+8 more)

### Community 49 - "Community 49"
Cohesion: 0.26
Nodes (8): AsyncClient, asyncio, Integration tests for /api/pricing/* endpoints. Internal back-office tooling --…, test_pricing_rejects_non_admin(), test_pricing_requires_admin(), TestBreakEvenEndpoint, TestMarginEndpoint, TestMarkupEndpoint

### Community 50 - "Community 50"
Cohesion: 0.13
Nodes (16): Delete dead code immediately (rule 7: no commented-out blocks, no _old files), Karpathy code-style skill (ruthless simplicity, no speculative abstraction), No speculative generality (rule 3: no plugin system/theme engine/i18n until 2nd real use case), content/site.config.ts (ceiling of abstraction for config), delete: tag (dead code, unused flexibility, speculative feature), native: tag (dependency doing what the platform already does), ponytail-review (over-engineering-focused code review), shrink: tag (same logic, fewer lines) (+8 more)

### Community 51 - "Community 51"
Cohesion: 0.16
Nodes (12): CATEGORIES, ContactPage(), handleSubmit(), Coupon, EditCouponRow(), emptyForm, apiBaseUrl(), NO_REFRESH (+4 more)

### Community 52 - "Community 52"
Cohesion: 0.21
Nodes (12): ConsentBanner(), choose(), PageViewTracker(), SearchOverlay(), SearchOverlayProps, ConsentState, EventType, getConsent() (+4 more)

### Community 53 - "Community 53"
Cohesion: 0.25
Nodes (15): cavecrew-builder Agent, cavecrew-investigator Agent, cavecrew-reviewer Agent, Cavecrew README, Cavecrew Decision Guide, cavecrew-builder subagent (surgical 1-2 file edit), cavecrew-investigator subagent (locate code, read-only), cavecrew-reviewer subagent (diff/file review) (+7 more)

### Community 54 - "Community 54"
Cohesion: 0.20
Nodes (15): Caveman Toolkit Repo README, Caveman Commit README, Caveman Commit — Terse Conventional Commits, Caveman Compress README, Caveman Compress Security Notes, Caveman Compress — Memory File Compression, Caveman Help README, Caveman Help — Quick Reference Card (+7 more)

### Community 55 - "Community 55"
Cohesion: 0.23
Nodes (13): HomepageContent, Homepage content overrides — a singleton row (id is always 1). Every field is…, get_homepage_content(), _get_or_create(), HomepageContentRead, HomepageContentWrite, AsyncSession, BaseModel (+5 more)

### Community 56 - "Community 56"
Cohesion: 0.13
Nodes (15): Accessorize London — About Us page scrape, Accessorize brand story: est. 1984, affordable stackable accessories, sustainability & charity commitments, Build Prompt: Fashion Accessories E-Commerce Site (Accessorize-style), Accessorize-style storefront structural/functional blueprint (headless commerce + Next.js/Remix or Shopify Liquid), Accessorize homepage section order: hero, promo tiles, New In grid, lifestyle tiles, promo banners, SEO/FAQ block, footer, Accessorize information architecture: 6 mega-menu nav sections (New In/Bags/Jewellery/Accessories/Kids/Sale), Accessorize PDP pattern: gallery, price+MRP, Add to cart/Buy it now, accordions, customer care block, Accessorize London — Contact Us page scrape (+7 more)

### Community 57 - "Community 57"
Cohesion: 0.20
Nodes (11): Storefront Content-Layer Editing, globals.css, collections, getCollectionBySlug(), getProductBySlug(), getProductsByCollectionSlug(), products, px() (+3 more)

### Community 58 - "Community 58"
Cohesion: 0.27
Nodes (12): analyze_product_description(), inspect_schema(), post, Recommendation-quality checker endpoints (Recommendation Agent tools)., Validate a product dict against schema.org Product JSON-LD guidance., Heuristically score a product description's LLM/recommendation readiness., DescriptionAnalyzerRequest, DescriptionAnalyzerResponse (+4 more)

### Community 59 - "Community 59"
Cohesion: 0.20
Nodes (13): Outbound email, provider-abstracted. EMAIL_DEV_STUB=true (the default) logs…, Order moved to 'shipped' with a courier/tracking number attached., Signup attempt on an address that already has an account. The API told the…, Deliver one message, or log it when the dev stub is on., New signup: prove control of the address., Forgot-password request: prove control of the inbox before letting a new…, Order placed — sent right after checkout (COD or, once wired, prepaid)., _send() (+5 more)

### Community 60 - "Community 60"
Cohesion: 0.30
Nodes (7): AsyncClient, asyncio, Integration tests for /api/inventory/* endpoints. Internal back-office tooling…, test_inventory_rejects_non_admin(), test_inventory_requires_admin(), TestBarcodeEndpoint, TestSkuEndpoint

### Community 61 - "Community 61"
Cohesion: 0.27
Nodes (13): Karpathy Simplicity Principles, Ponytail Audit — Repo-Wide Over-Engineering Scan, Ponytail Debt — Shortcut Ledger, Ponytail Gain — Impact Scoreboard, Ponytail Help — Quick Reference Card, Ponytail Review — Over-Engineering Diff Review, Ponytail Tag Taxonomy (delete/stdlib/native/yagni/shrink), Ponytail — Laziest Working Solution (+5 more)

### Community 62 - "Community 62"
Cohesion: 0.17
Nodes (9): addressLine(), Order, OrderItem, PAYMENT, PAYMENT_STYLE, ReturnRequest, ShippingDetail(), STATUS (+1 more)

### Community 63 - "Community 63"
Cohesion: 0.20
Nodes (12): Feminine, elegant, romantic/boutique visual brand style (wedding/gift-shop aesthetic), Logo color palette: metallic gold script, blush/dusty pink florals, white/cream florals, muted sage-green foliage, on a transparent/white background, Watercolor-style floral bouquet illustration (pink peonies/roses, white roses, green foliage) overlaid on the wordmark, Ambiguity: brand name includes the word "Teal" but no teal/turquoise color is visually present in the logo artwork itself, Gold cursive/calligraphic script wordmark reading "Savvy In Teal", Savvy In Teal (hair accessories & jewellery e-commerce brand), Savvy In Teal brand logo (gold script wordmark with pink/white floral bouquet), Soft, romantic color palette: blush/dusty pink florals, white accents, sage/muted green foliage, and metallic gold script text, on a transparent background (+4 more)

### Community 64 - "Community 64"
Cohesion: 0.36
Nodes (10): _create_collection(), AsyncClient, asyncio, AsyncSession, Collection, Tests for /api/collections endpoints., test_get_collection_404(), test_get_collection_by_slug() (+2 more)

### Community 65 - "Community 65"
Cohesion: 0.20
Nodes (10): AMBIGUOUS Confidence Level, Deep Mode Extraction, EXTRACTED Confidence Level, Graph Edge, INFERRED Confidence Level, calls Relation, cites Relation, implements Relation (+2 more)

### Community 66 - "Community 66"
Cohesion: 0.51
Nodes (9): _init_payment(), _make_prepaid_order(), AsyncClient, asyncio, AsyncSession, Regression tests: /razorpay/verify must bind to the razorpay_order_id issued…, test_verify_rejects_a_signature_replayed_from_a_different_order(), test_verify_rejects_when_init_was_never_called() (+1 more)

### Community 67 - "Community 67"
Cohesion: 0.20
Nodes (9): Editing this store with AI (docs/EDITING.md), Rules the AI follows: edits go in content/ never hardcoded in components, alt text required, must run npm run build/test, keep diffs small, Three editable content files: site.config.ts, catalog.ts, globals.css palette, Copy-paste owner prompts (change price, add product, change homepage, rebrand, seasonal campaign), Savvy In Teal storefront agent rules (frontend/AGENTS.md), Image handling: Pexels CDN via px() helper in site.config.ts or public/, new hosts added to next.config.ts remotePatterns, Embedded suspicious instruction block ("read node_modules/next/dist/docs") — prompt-injection-like, flagged and not followed, Agent rules: read storefront-editing/karpathy skills first, verify with npm run build/test, content in content/ not components/ (+1 more)

### Community 68 - "Community 68"
Cohesion: 0.22
Nodes (9): AST Extraction, CLAUDE.md Integration, Code Files, Cost Tracking, graphify, Post-Commit Hook, Token Reduction Benchmark, URL Ingest (+1 more)

### Community 69 - "Community 69"
Cohesion: 0.28
Nodes (8): do_run_migrations(), Run migrations in 'offline' mode. This configures the context with just a URL…, In this scenario we need to create an Engine and associate a connection with…, Run migrations in 'online' mode., run_async_migrations(), run_migrations_offline(), run_migrations_online(), Connection

### Community 70 - "Community 70"
Cohesion: 0.44
Nodes (9): docker-compose.yml (Postgres/Redis/RabbitMQ/backend/frontend/Caddy), backend service (built from ./backend), caddy service (caddy:2-alpine, sole publisher of ports 80/443), frontend service (built from ./frontend), NEXT_PUBLIC_API_URL must be set as a build arg — NEXT_PUBLIC_* vars are inlined into the client bundle at build time, Only Caddy publishes ports to host — Docker port publishing bypasses ufw via iptables, so publishing DB/queue ports directly is a security hole, postgres service (postgres:16-alpine), rabbitmq service (rabbitmq:3-management-alpine) (+1 more)

### Community 71 - "Community 71"
Cohesion: 0.22
Nodes (9): Accessorize PDP scrape — Black Fringe Shoulder Bag, PDP pattern: image gallery, price+discount%, quantity, Add to cart/Buy it now, Description/Details/More Info accordions, Build Prompt: Fast-Fashion Accessories E-Commerce Site (Zara-style), Zara-style minimalist editorial storefront blueprint (bespoke React/Next.js SPA, region/locale routing), Zara bot protection: interstitial iframe on plain HTTP GET, requires headless-Chromium stealth fetch, Zara PDP scrape — 100% Leather Long Gloves, Zara PDP pattern: hero editorial photo, price+discount, color swatches, minimal description, Complete your look rail, accordions, Zara — Women's Accessories SALE listing page scrape (stealth-fetch) (+1 more)

### Community 72 - "Community 72"
Cohesion: 0.25
Nodes (8): CATEGORY_LABEL, CATEGORY_STYLE, ContactMessage, Messages(), deleteMessage(), load(), setRead(), toggleExpand()

### Community 73 - "Community 73"
Cohesion: 0.36
Nodes (6): Coupon, A discount code, redeemable once per order at checkout., compute_discount(), Decimal, Coupon discount math — shared between the live validate-as-you-type endpoint…, Validate `coupon` against `subtotal` and return the discount amount. Raises:…

### Community 74 - "Community 74"
Cohesion: 0.43
Nodes (7): BreakEvenRequest, BreakEvenResponse, MarginRequest, MarginResponse, MarkupRequest, MarkupResponse, BaseModel

### Community 75 - "Community 75"
Cohesion: 0.32
Nodes (8): Backend Python dependency manifest (requirements.txt), bcrypt used directly (not via passlib) — security primitives must never be hand-rolled, app.services.description_analyzer module (textstat consumer), FastAPI/SQLAlchemy/asyncpg/Celery core backend stack, python-multipart pinned — required at runtime for Starlette UploadFile/Form parsing on media-library upload endpoint, qrcode added for alphanumeric coupon codes (python-barcode is EAN13/UPCA numeric-only), setuptools pinned <81 so optional textstat path works; Flesch approximation fallback if unavailable, Media-library uploads volume (app/routers/media.py) persisted outside Postgres

### Community 76 - "Community 76"
Cohesion: 0.46
Nodes (7): AsyncClient, asyncio, Tests for /api/customers (admin-only customer directory)., test_list_customers_as_admin(), test_list_customers_as_customer_403(), test_list_customers_never_leaks_password_hash(), test_list_customers_unauthenticated_401()

### Community 77 - "Community 77"
Cohesion: 0.36
Nodes (3): TestClient, TestDescriptionAnalyzerEndpoint, TestSchemaInspectorEndpoint

### Community 78 - "Community 78"
Cohesion: 0.36
Nodes (8): Corpus Detection, Document Files, Image Files, Paper Files, Semantic Extraction, Video Files, Video Transcription, Whisper Model

### Community 79 - "Community 79"
Cohesion: 0.25
Nodes (8): Accessorize London — Bags category listing page scrape, Accessorize faceted filters: Colour, Price, Occasion, Product type + sort dropdown + pagination, Build Prompt: Luxury Hair Accessories E-Commerce Site (FranceLuxe-style), FranceLuxe-style multi-brand hair-accessories storefront blueprint (Shopify native or headless + faceted search), FranceLuxe — Hair Accessories collection page scrape, FranceLuxe faceted filters: Brand, Product type, Color (80+), Price, Size, Material, FranceLuxe mega-menu nav: New/Bestsellers/Hair Accessories/Home & Body/Brands/Sale with promo image tiles, FranceLuxe product card: hover-swap image, toggle swatches, vendor name, price range, View full details CTA

### Community 80 - "Community 80"
Cohesion: 0.25
Nodes (6): AdClickFlag, CheckoutVelocityFlag, CouponAbuseFlag, CouponAbuseTable(), Fraud(), FraudSummary

### Community 81 - "Community 81"
Cohesion: 0.39
Nodes (5): adaptProduct(), adaptVariant(), asStringArray(), BackendProduct, BackendProductVariant

### Community 82 - "Community 82"
Cohesion: 0.25
Nodes (8): frontend/README.md (create-next-app default), Standard create-next-app boilerplate: npm run dev, next/font Geist, Vercel deploy links, Savvy In Teal — E-Commerce Test Bed README, Podman Desktop chosen over Docker Desktop for local infra (OSI-open-source license requirement), Repository structure (frontend / backend / docker-compose.yml), Project roadmap (Phase 1 calculators, Phase 2 eval dashboard, Phase 3 ops tooling, Later: LLM agents/Celery), Savvy In Teal storefront (hair accessories & jewellery brand), savvyarchitect.md (project root roadmap notes, referenced but not in this chunk)

### Community 83 - "Community 83"
Cohesion: 0.29
Nodes (4): Order, OrderItem, STATUS_LABEL, TrackOrderView()

### Community 84 - "Community 84"
Cohesion: 0.29
Nodes (5): inputCls, Address, Customer, EditCustomerForm(), oneLine()

### Community 85 - "Community 85"
Cohesion: 0.47
Nodes (6): optional_current_user(), AsyncSession, Request, Resolve the signed-in user from the access-token cookie, or 401. The user is…, Same resolution as require_current_user, but returns None instead of 401. For…, require_current_user()

### Community 86 - "Community 86"
Cohesion: 0.47
Nodes (5): BarcodeRequest, BaseModel, Request/response schemas for the inventory router., SkuBulkRequest, SkuBulkResponse

### Community 87 - "Community 87"
Cohesion: 0.40
Nodes (5): ErrorLogEntry, ErrorLogs(), clearAll(), load(), statusStyle()

### Community 88 - "Community 88"
Cohesion: 0.40
Nodes (4): health_check(), get, Health check endpoint., Return a simple liveness signal for load balancers / uptime checks.

### Community 89 - "Community 89"
Cohesion: 0.40
Nodes (4): ping(), Stub Celery tasks proving the task queue wiring works. Real agent tasks…, Trivial task used to prove Celery task registration works end-to-end., task

### Community 91 - "Community 91"
Cohesion: 0.50
Nodes (5): caveman-mode-tracker hook (intercepts /caveman-stats), caveman-stats (real session token receipts), hooks/caveman-mode-tracker.js, caveman-stats skill (delivered by hook, no model computation), hooks/caveman-stats.js

### Community 92 - "Community 92"
Cohesion: 0.67
Nodes (4): caveman-mode-tracker.js hook, caveman-stats.js hook, Caveman Stats README, Caveman Stats — Session Token Report

### Community 93 - "Community 93"
Cohesion: 0.50
Nodes (4): BFS Traversal, Graph Query, Token Budget, Vocabulary Expansion

### Community 94 - "Community 94"
Cohesion: 0.50
Nodes (4): Graph Explain, Graph Node, Node ID Format, Source Location

### Community 118 - "Community 118"
Cohesion: 0.67
Nodes (3): Cluster-Only Mode, Clustering, Community Detection

### Community 119 - "Community 119"
Cohesion: 0.67
Nodes (3): Extraction Caching, Incremental Update, Manifest File

## Ambiguous Edges - Review These
- `Notable ambiguity: the brand name 'Savvy In Teal' implies a teal color identity, but no teal/blue-green hue is actually visible anywhere in the logo artwork itself (palette is pink/white/green/gold) - teal may be used elsewhere in the site's UI theme instead of the logo mark` → `Savvy In Teal brand logo (WebP) - elegant gold script wordmark 'Savvy In Teal' overlaid on a pink, white and green watercolor floral bouquet, transparent background`  [AMBIGUOUS]
  frontend/public/brand/logo.webp · relation: raises_question_about
- `Transparent or white background field` → `Savvy In Teal logo (small variant)`  [AMBIGUOUS]
  frontend/public/brand/logo-sm.png · relation: references

## Knowledge Gaps
- **202 isolated node(s):** `EditCell`, `Order`, `OrderItem`, `NewsletterFormProps`, `WishlistContextValue` (+197 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 724 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Notable ambiguity: the brand name 'Savvy In Teal' implies a teal color identity, but no teal/blue-green hue is actually visible anywhere in the logo artwork itself (palette is pink/white/green/gold) - teal may be used elsewhere in the site's UI theme instead of the logo mark` and `Savvy In Teal brand logo (WebP) - elegant gold script wordmark 'Savvy In Teal' overlaid on a pink, white and green watercolor floral bouquet, transparent background`?**
  _Edge tagged AMBIGUOUS (relation: raises_question_about) - confidence is low._
- **What is the exact relationship between `Transparent or white background field` and `Savvy In Teal logo (small variant)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `get_settings()` connect `Backend Config & Celery` to `Orders & Razorpay Payments`, `Community 69`, `Security & Token Service`, `Async DB Engine`, `User Model`, `Auth Login Flow`, `Auth Profile Endpoints`, `Community 59`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Why does `Base` connect `Database Models` to `Auth Tokens & Tests`, `Community 69`, `Community 73`, `Async DB Engine`, `User Model`, `Order Models`, `Community 55`, `Products API`, `Categories`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Why does `User` connect `User Model` to `Community 32`, `Auth Tokens & Tests`, `Security & Token Service`, `Database Models`, `Async DB Engine`, `Auth Login Flow`, `Community 85`, `Auth Profile Endpoints`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **What connects `EditCell`, `Order`, `OrderItem` to the rest of the system?**
  _202 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Auth Tokens & Tests` be split into smaller, more focused modules?**
  _Cohesion score 0.0676056338028169 - nodes in this community are weakly interconnected._