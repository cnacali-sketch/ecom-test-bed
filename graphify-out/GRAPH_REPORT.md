# Graph Report - ecom-test-bed  (2026-09-11)

## Corpus Check
- 342 files · ~188,765 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2387 nodes · 4844 edges · 167 communities (108 shown, 27 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 213 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `fe8dc049`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- test_routers_auth.py
- test_routers_orders.py
- auth-context.tsx
- .agents/skills/caveman-compress/scripts/validate.py
- .claude/skills/caveman-compress/scripts/validate.py
- orders.py
- get_settings
- dependencies/auth.py
- ProductEditor.tsx
- routers/pricing.py
- events.py
- devDependencies
- Base
- lib/types.ts
- generate_sku
- apiFetch
- db.py
- conftest.py
- routers/coupons.py
- generate_upca
- routers/auth.py
- compilerOptions
- ReturnRequest
- test_routers_media.py
- image-prepare.ts
- test_routers_products.py
- app/layout.tsx
- Product
- test_routers_coupons.py
- categories.py
- admin/types.ts
- contact.py
- User
- description_analyzer.py
- What You Must Do When Invoked
- site.config.ts
- analyze_description
- Knowledge Graph
- ProductGrid.tsx
- refresh_tokens.py
- Savvy In Teal logo (small variant)
- seo.ts
- AdminApp.tsx
- inspect_product_schema
- test_routers_returns.py
- caveman-help skill instructions (modes, skills table, config)
- Header.tsx
- get_collection
- test_routers_contact.py
- AsyncClient
- ponytail-review (over-engineering-focused code review)
- api-client.ts
- SearchOverlay.tsx
- Cavecrew Decision Guide
- Caveman Help — Quick Reference Card
- main.py
- Build Prompt: Fashion Accessories E-Commerce Site (Accessorize-style)
- api.ts
- routers/recommendation.py
- email.py
- AsyncClient
- Ponytail Help — Quick Reference Card
- Orders.tsx
- Savvy In Teal brand logo (gold script wordmark with pink/white floral bouquet)
- test_routers_collections.py
- Graph Edge
- test_razorpay_verify_binding.py
- Editing this store with AI (docs/EDITING.md)
- graphify
- env.py
- docker-compose.yml (Postgres/Redis/RabbitMQ/backend/frontend/Caddy)
- Build Prompt: Fast-Fashion Accessories E-Commerce Site (Zara-style)
- Messages.tsx
- AdminApi
- payments.py
- Backend Python dependency manifest (requirements.txt)
- test_routers_customers.py
- AsyncClient
- Semantic Extraction
- FranceLuxe — Hair Accessories collection page scrape
- media.py
- razorpay.py
- Savvy In Teal — E-Commerce Test Bed README
- track-order/page.tsx
- Customers.tsx
- bulk_generate
- routers/inventory.py
- compute_ean13_checksum
- generate_ean13
- example_tasks.py
- TestHealthRouter
- caveman-mode-tracker hook (intercepts /caveman-stats)
- Caveman Stats README
- Graph Query
- Graph Node
- Clustering
- Incremental Update
- coming-soon/page.tsx
- .agents/skills/caveman-compress/scripts/__init__.py
- .claude/skills/caveman-compress/scripts/__init__.py
- eslint.config.mjs
- postcss.config.mjs
- tailwind.config.ts
- graphify reference: extra exports and benchmark
- create_app
- Ponytail Help
- Logo color palette: gold script, blush pink, sage/eucalyptus green, cream/white
- Pink watercolor rose and eucalyptus greenery floral motif
- "Savvy In Teal" brand wordmark design
- Savvy In Teal small logo (webp) - gold cursive wordmark with pink floral and greenery accents
- Photo uploader — phone → PC → media library
- caveman-help
- caveman-review
- graphify reference: query, path, explain
- _load_catalog_via_tsx
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- client_ip
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- account/layout.tsx
- admin/layout.tsx
- admin/login/layout.tsx
- checkout/layout.tsx
- contact/layout.tsx
- forgot-password/layout.tsx
- app/login/layout.tsx
- register/layout.tsx
- reset-password/layout.tsx
- track-order/layout.tsx
- verify-email/layout.tsx
- CLAUDE.md
- .claude/CLAUDE.md
- extraction-spec.md

## God Nodes (most connected - your core abstractions)
1. `apiFetch()` - 64 edges
2. `get_settings()` - 48 edges
3. `User` - 46 edges
4. `Base` - 40 edges
5. `Product` - 29 edges
6. `SiteConfig` - 29 edges
7. `Order` - 26 edges
8. `create_order()` - 23 edges
9. `useAuth()` - 23 edges
10. `Product` - 22 edges

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

## Communities (167 total, 27 thin omitted)

### Community 0 - "test_routers_auth.py"
Cohesion: 0.07
Nodes (71): Refresh token records — the server-side half of Refresh Token Rotation. Every…, One issued refresh token. Rotated on every use., RefreshToken, _no_real_email(), AsyncClient, asyncio, fixture, Tests for /api/auth endpoints, the JWT cookie gate, and refresh rotation. (+63 more)

### Community 1 - "test_routers_orders.py"
Cohesion: 0.08
Nodes (64): _make_coupon(), _make_tracked_product(), product_id(), AsyncClient, asyncio, AsyncSession, fixture, Tests for /api/orders endpoints. (+56 more)

### Community 2 - "auth-context.tsx"
Cohesion: 0.06
Nodes (38): AccountView(), AdminLoginPage(), handleLogin(), CheckoutPage(), handleApplyCoupon(), handlePlaceOrder(), ForgotPasswordPage(), LoginPage() (+30 more)

### Community 3 - ".agents/skills/caveman-compress/scripts/validate.py"
Cohesion: 0.06
Nodes (49): benchmark_pair(), count_tokens(), main(), print_table(), Path, main(), print_usage(), backup_dir_for() (+41 more)

### Community 4 - ".claude/skills/caveman-compress/scripts/validate.py"
Cohesion: 0.06
Nodes (49): benchmark_pair(), count_tokens(), main(), print_table(), Path, main(), print_usage(), backup_dir_for() (+41 more)

### Community 5 - "orders.py"
Cohesion: 0.09
Nodes (49): Order, A customer order, composed of one or more `OrderItem` rows., _authoritative_pricing(), create_order(), flag_order(), get_order(), list_all_orders(), list_orders() (+41 more)

### Community 6 - "get_settings"
Cohesion: 0.08
Nodes (27): AsyncEngine, Celery application wiring. This only proves the task queue is wired up…, get_settings(), Application configuration loaded from environment variables. Uses pydantic-…, Return CORS origins as a list, split on commas., Return a cached Settings instance (avoids re-parsing env on every call)., Central application settings. All values have safe local-dev defaults so the…, Settings (+19 more)

### Community 7 - "dependencies/auth.py"
Cohesion: 0.08
Nodes (47): Authentication dependencies. JWT in an httpOnly cookie is the gate (P1) — it…, create_access_token(), create_refresh_token(), create_reset_token(), _create_token(), create_verify_token(), decode_token(), dummy_verify() (+39 more)

### Community 8 - "ProductEditor.tsx"
Cohesion: 0.12
Nodes (34): AdminOrderSummary, LoadState, DiscountBadge(), Field(), HelpTip(), inputCls, ShowToggle(), Toggle() (+26 more)

### Community 9 - "routers/pricing.py"
Cohesion: 0.09
Nodes (26): calculate_break_even(), calculate_markup(), calculate_profit_margin(), post, Pricing calculator endpoints (Pricing Agent tools)., Compute the retail price from cost and desired margin percentage., Compute the profit margin percentage from cost and selling price., Compute the number of units needed to break even on fixed costs. (+18 more)

### Community 10 - "events.py"
Cohesion: 0.09
Nodes (45): UserEvent ORM model -- tracks browse/click/purchase/review events., A single user interaction event (browse, click, purchase, review, ...). Indexed…, UserEvent, AdClickFlag, CheckoutVelocityFlag, _classify_browser(), _classify_device(), CouponAbuseFlag (+37 more)

### Community 11 - "devDependencies"
Cohesion: 0.05
Nodes (41): eslint, eslint-config-next, @fontsource-variable/archivo, @fontsource-variable/fraunces, dependencies, @fontsource-variable/archivo, @fontsource-variable/fraunces, lucide-react (+33 more)

### Community 12 - "Base"
Cohesion: 0.11
Nodes (24): Base, Shared declarative base for all ORM models., AgentDecision, AgentDecision ORM model -- audit log of agent input/output pairs., Records what an agent decided, given a specific input, for auditing/eval., Collection, Collection ORM model — the core navigation unit for the storefront. A…, A named grouping of products (e.g. Hair Accessories, Jewellery). (+16 more)

### Community 13 - "lib/types.ts"
Cohesion: 0.09
Nodes (35): SpecimenRanges(), SpecimenRangesProps, AddedToast(), CartDrawer(), EMPTY_STATE_SHORTCUTS, AccordionSection(), AccordionSectionProps, CrossSellRail() (+27 more)

### Community 14 - "generate_sku"
Cohesion: 0.24
Nodes (5): generate_sku(), Validate a brand/category/size segment, returning it uppercased. Raises:…, Generate a single SKU string: "{BRAND}-{CATEGORY}-{SIZE}-{seq:04d}". Raises:…, _validate_segment(), TestGenerateSku

### Community 15 - "apiFetch"
Cohesion: 0.07
Nodes (41): Status, VerifyEmail(), Order, OrderHistory(), submitReturn(), STATUS_LABEL, useDnd(), CategoryManager() (+33 more)

### Community 16 - "db.py"
Cohesion: 0.10
Nodes (21): Async SQLAlchemy engine/session setup. The engine is created lazily and is…, ErrorLoggingMiddleware, Request, Captures server errors (500) and auth/permission denials (401/403) into the…, _write_log(), ErrorLog, ErrorLog ORM model — captures server errors and auth/permission failures so an…, normalize_email() (+13 more)

### Community 17 - "conftest.py"
Cohesion: 0.15
Nodes (22): admin_client(), admin_user(), _clear_login_throttle(), client(), customer_client(), customer_user(), db_session(), _http_test_cookies() (+14 more)

### Community 18 - "routers/coupons.py"
Cohesion: 0.11
Nodes (37): Coupon, A discount code, redeemable once per order at checkout., coupon_qr(), CouponCreate, CouponEdit, CouponRead, CouponValidate, CouponValidateResponse (+29 more)

### Community 19 - "generate_upca"
Cohesion: 0.22
Nodes (8): generate_upca(), UPC-A / EAN-13 barcode generation with PNG + SVG export. Uses the open-source…, Validate that `code` is exactly `expected_length` numeric digits. Raises:…, Render a `python-barcode` instance to PNG and SVG bytes., Generate a UPC-A barcode (PNG + SVG) from an 11-digit code. Returns: dict with…, _render_barcode(), _validate_numeric_code(), TestGenerateUpca

### Community 20 - "routers/auth.py"
Cohesion: 0.08
Nodes (50): _clear_auth_cookies(), forgot_password(), login(), logout(), me(), AsyncSession, BackgroundTasks, get (+42 more)

### Community 21 - "compilerOptions"
Cohesion: 0.07
Nodes (28): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+20 more)

### Community 22 - "ReturnRequest"
Cohesion: 0.16
Nodes (15): A customer-initiated request to return a delivered order., ReturnRequest, create_return_request(), list_return_requests(), AsyncSession, get, patch, post (+7 more)

### Community 23 - "test_routers_media.py"
Cohesion: 0.23
Nodes (14): _cleanup_uploaded_files(), _png_bytes(), AsyncClient, asyncio, fixture, Tests for /api/media (admin file uploads). The upload's own Content-Type header…, media.py has no DB -- successful uploads land as real files on disk (UPLOAD_DIR…, The exact attack this closes: real content is HTML/script, but the Content-Type… (+6 more)

### Community 24 - "image-prepare.ts"
Cohesion: 0.11
Nodes (32): clampRect(), ImageEditor(), confirm(), mirror(), onKeyDown(), onPointerMove(), turn(), maxWindow() (+24 more)

### Community 25 - "test_routers_products.py"
Cohesion: 0.19
Nodes (26): _create(), AsyncClient, asyncio, Tests for /api/products endpoints. Uses an in-memory SQLite DB via conftest.…, The admin UI sends no variants; the PUT must not wipe them., A caller that only edits price/stock must not wipe attrs it doesn't model., sku is an identity key (used as the storefront product id) — immutable via PUT., test_collection_filter() (+18 more)

### Community 26 - "app/layout.tsx"
Cohesion: 0.09
Nodes (23): Storefront Content-Layer Editing, globals.css, metadata, viewport, ConsentBanner(), choose(), PageViewTracker(), Footer() (+15 more)

### Community 27 - "Product"
Cohesion: 0.15
Nodes (25): Product, A sellable product, grouping one or more `ProductVariant` rows., create_product(), delete_product(), get_product(), get_product_by_slug(), list_products(), AsyncSession (+17 more)

### Community 28 - "test_routers_coupons.py"
Cohesion: 0.25
Nodes (24): _coupon_payload(), AsyncClient, asyncio, Tests for /api/coupons endpoints., Public and unauthenticated -- without this cap it's a free oracle for brute-…, test_coupon_qr_requires_admin(), test_coupon_qr_returns_png(), test_create_coupon_as_admin() (+16 more)

### Community 29 - "categories.py"
Cohesion: 0.16
Nodes (22): Category, Product category ORM model. Distinct from `Collection` (Hair Accessories /…, CategoryCreate, CategoryRead, CategoryUpdate, create_category(), delete_category(), list_categories() (+14 more)

### Community 30 - "admin/types.ts"
Cohesion: 0.09
Nodes (29): ImageDrop(), acceptCrop(), upload(), Meta, PARENTS, Destination, DEFAULTS, EditorialTile (+21 more)

### Community 31 - "contact.py"
Cohesion: 0.14
Nodes (22): ContactMessage, ContactMessage ORM model — submissions from the public /contact form (query,…, ContactAdminRead, ContactCreate, ContactRead, create_contact_message(), delete_contact_message(), _get_message_or_404() (+14 more)

### Community 32 - "User"
Cohesion: 0.11
Nodes (31): optional_current_user(), AsyncSession, Request, Resolve the signed-in user from the access-token cookie, or 401. The user is…, Gate admin-only endpoints. 403 (not 401) — the caller is known, just not…, Same resolution as require_current_user, but returns None instead of 401. For…, require_admin(), require_current_user() (+23 more)

### Community 33 - "description_analyzer.py"
Cohesion: 0.12
Nodes (18): Heuristic scoring of product description text for LLM/recommendation readiness.…, Return lowercase word tokens from `text`., Return the Flesch reading ease score, preferring `textstat` if available., _readability_score(), _split_words(), check_keyword_density(), Keyword-density scoring (most-frequent-word ratio)., Score keyword density; return (points_out_of_30, issues, suggestions). (+10 more)

### Community 34 - "What You Must Do When Invoked"
Cohesion: 0.07
Nodes (26): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+18 more)

### Community 35 - "site.config.ts"
Cohesion: 0.08
Nodes (28): alt, contentType, size, HomePage(), metadata, metadata, metadata, metadata (+20 more)

### Community 36 - "analyze_description"
Cohesion: 0.18
Nodes (6): analyze_description(), Heuristically score a product description's LLM/recommendation readiness.…, Unit tests for app.services.description_analyzer (pure functions, no LLM call)., Covers the self-contained Flesch approximation used when `textstat` (or its…, TestAnalyzeDescription, TestFallbackReadabilityWithoutTextstat

### Community 37 - "Knowledge Graph"
Cohesion: 0.11
Nodes (20): Cross-Repo Merge, Directed Graph, FalkorDB Export, GraphML Export, HTML Export, JSON Export, Neo4j Export, SVG Export (+12 more)

### Community 38 - "ProductGrid.tsx"
Cohesion: 0.15
Nodes (16): ActiveFilters, COLOR_HEX_MAP, FacetGroupProps, FilterSidebar(), FilterSidebarProps, buildFacetCounts(), EMPTY_FILTERS, matchesFilters() (+8 more)

### Community 39 - "refresh_tokens.py"
Cohesion: 0.18
Nodes (18): issue(), purge_expired(), AsyncSession, Exception, UUID, Refresh Token Rotation (RTR) with reuse detection. The rule: a refresh token is…, A refresh token was presented that was already spent, or has no record. Both…, Mint a refresh token and record it. Omit `family_id` to start a session. (+10 more)

### Community 40 - "Savvy In Teal logo (small variant)"
Cohesion: 0.14
Nodes (19): Blush Pink & Gold Botanical Color Palette, Savvy In Teal brand identity: feminine, romantic, boutique hair-accessories & jewellery aesthetic, Watercolor-style floral bouquet motif (pink peonies, blush roses, white roses, green foliage) overlaid on the wordmark, Logo color palette: gold/black script, blush-pink & white florals, muted green foliage on transparent ground - notably no teal hue despite the brand name, Large ('-lg') logo variant, likely intended for header/hero/high-resolution storefront placements, "Savvy In Teal" gold cursive script wordmark with black outline/drop-shadow, Savvy In Teal logo (large) - gold cursive wordmark with pink/white floral bouquet, Savvy In Teal Logo (Large, WebP) (+11 more)

### Community 41 - "seo.ts"
Cohesion: 0.10
Nodes (33): CollectionPage(), CollectionPageProps, generateMetadata(), escapeXml(), feedItem(), GET(), revalidate, tag() (+25 more)

### Community 42 - "AdminApp.tsx"
Cohesion: 0.15
Nodes (22): AdminApp(), loadFailureMessage(), newDraft(), attrNum(), attrStr(), measurementsFrom(), readBadge(), readDims() (+14 more)

### Community 43 - "inspect_product_schema"
Cohesion: 0.18
Nodes (9): _find_missing(), _get_nested(), inspect_product_schema(), Validates a product dict against schema.org Product JSON-LD guidance. Fields…, Look up a possibly-nested field (e.g. "offers.price") in `product`. Returns…, Return the subset of `fields` that are missing or falsy in `product`., Validate `product` against schema.org Product required/recommended fields.…, Unit tests for app.services.product_schema_inspector (pure functions, no I/O). (+1 more)

### Community 44 - "test_routers_returns.py"
Cohesion: 0.32
Nodes (17): _make_delivered_order(), _make_tracked_product(), _make_untracked_product(), AsyncClient, asyncio, Tests for /api/returns endpoints., A real product with no stock tracking (attrs.stock unset) — order_items now has…, test_approve_paid_return_refunds_and_restocks() (+9 more)

### Community 45 - "caveman-help skill instructions (modes, skills table, config)"
Cohesion: 0.12
Nodes (18): Auto-clarity (inherited from caveman), caveman-commit (terse Conventional Commits generator), Auto-Clarity (always body for breaking changes/security/migrations/reverts), caveman-commit skill instructions, caveman-compress (compress memory files to save tokens), Snyk High Risk rating is a false positive: fixed-arg subprocess (no shell interpolation), file I/O confined to user-specified path with .original.md backup, CLI fallback only without ANTHROPIC_API_KEY, files >500KB rejected pre-API-call, caveman-compress skill instructions (compression rules, process, boundaries), caveman-help skill instructions (modes, skills table, config) (+10 more)

### Community 46 - "Header.tsx"
Cohesion: 0.13
Nodes (12): Header(), commit(), onBreakpoint(), onScroll(), openSearch(), setP(), HeaderProps, MegaMenu() (+4 more)

### Community 47 - "get_collection"
Cohesion: 0.17
Nodes (14): CollectionDetail, CollectionRead, get_collection(), list_collections(), AsyncSession, BaseModel, get, List all collections (nav/marketing metadata). (+6 more)

### Community 48 - "test_routers_contact.py"
Cohesion: 0.34
Nodes (16): _contact_payload(), AsyncClient, asyncio, Tests for /api/contact endpoints., The submitter's own confirmation must not echo back their recorded IP., test_admin_list_still_includes_ip_address(), test_delete_message_as_admin(), test_delete_message_as_customer_403() (+8 more)

### Community 49 - "AsyncClient"
Cohesion: 0.26
Nodes (8): AsyncClient, asyncio, Integration tests for /api/pricing/* endpoints. Internal back-office tooling --…, test_pricing_rejects_non_admin(), test_pricing_requires_admin(), TestBreakEvenEndpoint, TestMarginEndpoint, TestMarkupEndpoint

### Community 50 - "ponytail-review (over-engineering-focused code review)"
Cohesion: 0.13
Nodes (16): Delete dead code immediately (rule 7: no commented-out blocks, no _old files), Karpathy code-style skill (ruthless simplicity, no speculative abstraction), No speculative generality (rule 3: no plugin system/theme engine/i18n until 2nd real use case), content/site.config.ts (ceiling of abstraction for config), delete: tag (dead code, unused flexibility, speculative feature), native: tag (dependency doing what the platform already does), ponytail-review (over-engineering-focused code review), shrink: tag (same logic, fewer lines) (+8 more)

### Community 51 - "api-client.ts"
Cohesion: 0.07
Nodes (23): CATEGORIES, ContactPage(), handleSubmit(), Analytics(), EventSummary, FUNNEL_STEPS, LocationCount, TopProduct (+15 more)

### Community 52 - "SearchOverlay.tsx"
Cohesion: 0.22
Nodes (10): metadata, SearchPage(), SearchPageProps, SearchOverlay(), goToResults(), onKeyDown(), SearchOverlayProps, haystack() (+2 more)

### Community 53 - "Cavecrew Decision Guide"
Cohesion: 0.25
Nodes (15): cavecrew-builder Agent, cavecrew-investigator Agent, cavecrew-reviewer Agent, Cavecrew README, Cavecrew Decision Guide, cavecrew-builder subagent (surgical 1-2 file edit), cavecrew-investigator subagent (locate code, read-only), cavecrew-reviewer subagent (diff/file review) (+7 more)

### Community 54 - "Caveman Help — Quick Reference Card"
Cohesion: 0.20
Nodes (15): Caveman Toolkit Repo README, Caveman Commit README, Caveman Commit — Terse Conventional Commits, Caveman Compress README, Caveman Compress Security Notes, Caveman Compress — Memory File Compression, Caveman Help README, Caveman Help — Quick Reference Card (+7 more)

### Community 55 - "main.py"
Cohesion: 0.10
Nodes (24): get_db_session(), AsyncSession, FastAPI dependency yielding an AsyncSession, closed after the request., FastAPI application entrypoint., health_check(), get, Health check endpoint., Return a simple liveness signal for load balancers / uptime checks. (+16 more)

### Community 56 - "Build Prompt: Fashion Accessories E-Commerce Site (Accessorize-style)"
Cohesion: 0.13
Nodes (15): Accessorize London — About Us page scrape, Accessorize brand story: est. 1984, affordable stackable accessories, sustainability & charity commitments, Build Prompt: Fashion Accessories E-Commerce Site (Accessorize-style), Accessorize-style storefront structural/functional blueprint (headless commerce + Next.js/Remix or Shopify Liquid), Accessorize homepage section order: hero, promo tiles, New In grid, lifestyle tiles, promo banners, SEO/FAQ block, footer, Accessorize information architecture: 6 mega-menu nav sections (New In/Bags/Jewellery/Accessories/Kids/Sale), Accessorize PDP pattern: gallery, price+MRP, Add to cart/Buy it now, accordions, customer care block, Accessorize London — Contact Us page scrape (+7 more)

### Community 57 - "api.ts"
Cohesion: 0.22
Nodes (12): collections, getCollectionBySlug(), getProductBySlug(), getProductsByCollectionSlug(), products, apiBaseUrl(), BackendCollection, fetchJson() (+4 more)

### Community 58 - "routers/recommendation.py"
Cohesion: 0.27
Nodes (12): analyze_product_description(), inspect_schema(), post, Recommendation-quality checker endpoints (Recommendation Agent tools)., Validate a product dict against schema.org Product JSON-LD guidance., Heuristically score a product description's LLM/recommendation readiness., DescriptionAnalyzerRequest, DescriptionAnalyzerResponse (+4 more)

### Community 59 - "email.py"
Cohesion: 0.23
Nodes (11): Outbound email, provider-abstracted. EMAIL_DEV_STUB=true (the default) logs…, Order moved to 'shipped' with a courier/tracking number attached., Signup attempt on an address that already has an account. The API told the…, Deliver one message, or log it when the dev stub is on., New signup: prove control of the address., Forgot-password request: prove control of the inbox before letting a new…, _send(), send_account_exists_email() (+3 more)

### Community 60 - "AsyncClient"
Cohesion: 0.30
Nodes (7): AsyncClient, asyncio, Integration tests for /api/inventory/* endpoints. Internal back-office tooling…, test_inventory_rejects_non_admin(), test_inventory_requires_admin(), TestBarcodeEndpoint, TestSkuEndpoint

### Community 61 - "Ponytail Help — Quick Reference Card"
Cohesion: 0.27
Nodes (13): Karpathy Simplicity Principles, Ponytail Audit — Repo-Wide Over-Engineering Scan, Ponytail Debt — Shortcut Ledger, Ponytail Gain — Impact Scoreboard, Ponytail Help — Quick Reference Card, Ponytail Review — Over-Engineering Diff Review, Ponytail Tag Taxonomy (delete/stdlib/native/yagni/shrink), Ponytail — Laziest Working Solution (+5 more)

### Community 62 - "Orders.tsx"
Cohesion: 0.17
Nodes (9): addressLine(), Order, OrderItem, PAYMENT, PAYMENT_STYLE, ReturnRequest, ShippingDetail(), STATUS (+1 more)

### Community 63 - "Savvy In Teal brand logo (gold script wordmark with pink/white floral bouquet)"
Cohesion: 0.20
Nodes (12): Feminine, elegant, romantic/boutique visual brand style (wedding/gift-shop aesthetic), Logo color palette: metallic gold script, blush/dusty pink florals, white/cream florals, muted sage-green foliage, on a transparent/white background, Watercolor-style floral bouquet illustration (pink peonies/roses, white roses, green foliage) overlaid on the wordmark, Ambiguity: brand name includes the word "Teal" but no teal/turquoise color is visually present in the logo artwork itself, Gold cursive/calligraphic script wordmark reading "Savvy In Teal", Savvy In Teal (hair accessories & jewellery e-commerce brand), Savvy In Teal brand logo (gold script wordmark with pink/white floral bouquet), Soft, romantic color palette: blush/dusty pink florals, white accents, sage/muted green foliage, and metallic gold script text, on a transparent background (+4 more)

### Community 64 - "test_routers_collections.py"
Cohesion: 0.33
Nodes (12): _create_collection(), AsyncClient, asyncio, AsyncSession, Collection, Tests for /api/collections endpoints., A collection that actually contains a product must serialise. Regression test…, test_get_collection_404() (+4 more)

### Community 65 - "Graph Edge"
Cohesion: 0.20
Nodes (10): AMBIGUOUS Confidence Level, Deep Mode Extraction, EXTRACTED Confidence Level, Graph Edge, INFERRED Confidence Level, calls Relation, cites Relation, implements Relation (+2 more)

### Community 66 - "test_razorpay_verify_binding.py"
Cohesion: 0.51
Nodes (9): _init_payment(), _make_prepaid_order(), AsyncClient, asyncio, AsyncSession, Regression tests: /razorpay/verify must bind to the razorpay_order_id issued…, test_verify_rejects_a_signature_replayed_from_a_different_order(), test_verify_rejects_when_init_was_never_called() (+1 more)

### Community 67 - "Editing this store with AI (docs/EDITING.md)"
Cohesion: 0.20
Nodes (9): Editing this store with AI (docs/EDITING.md), Rules the AI follows: edits go in content/ never hardcoded in components, alt text required, must run npm run build/test, keep diffs small, Three editable content files: site.config.ts, catalog.ts, globals.css palette, Copy-paste owner prompts (change price, add product, change homepage, rebrand, seasonal campaign), Savvy In Teal storefront agent rules (frontend/AGENTS.md), Image handling: Pexels CDN via px() helper in site.config.ts or public/, new hosts added to next.config.ts remotePatterns, Embedded suspicious instruction block ("read node_modules/next/dist/docs") — prompt-injection-like, flagged and not followed, Agent rules: read storefront-editing/karpathy skills first, verify with npm run build/test, content in content/ not components/ (+1 more)

### Community 68 - "graphify"
Cohesion: 0.22
Nodes (9): AST Extraction, CLAUDE.md Integration, Code Files, Cost Tracking, graphify, Post-Commit Hook, Token Reduction Benchmark, URL Ingest (+1 more)

### Community 69 - "env.py"
Cohesion: 0.28
Nodes (8): do_run_migrations(), Run migrations in 'offline' mode. This configures the context with just a URL…, In this scenario we need to create an Engine and associate a connection with…, Run migrations in 'online' mode., run_async_migrations(), run_migrations_offline(), run_migrations_online(), Connection

### Community 70 - "docker-compose.yml (Postgres/Redis/RabbitMQ/backend/frontend/Caddy)"
Cohesion: 0.44
Nodes (9): docker-compose.yml (Postgres/Redis/RabbitMQ/backend/frontend/Caddy), backend service (built from ./backend), caddy service (caddy:2-alpine, sole publisher of ports 80/443), frontend service (built from ./frontend), NEXT_PUBLIC_API_URL must be set as a build arg — NEXT_PUBLIC_* vars are inlined into the client bundle at build time, Only Caddy publishes ports to host — Docker port publishing bypasses ufw via iptables, so publishing DB/queue ports directly is a security hole, postgres service (postgres:16-alpine), rabbitmq service (rabbitmq:3-management-alpine) (+1 more)

### Community 71 - "Build Prompt: Fast-Fashion Accessories E-Commerce Site (Zara-style)"
Cohesion: 0.22
Nodes (9): Accessorize PDP scrape — Black Fringe Shoulder Bag, PDP pattern: image gallery, price+discount%, quantity, Add to cart/Buy it now, Description/Details/More Info accordions, Build Prompt: Fast-Fashion Accessories E-Commerce Site (Zara-style), Zara-style minimalist editorial storefront blueprint (bespoke React/Next.js SPA, region/locale routing), Zara bot protection: interstitial iframe on plain HTTP GET, requires headless-Chromium stealth fetch, Zara PDP scrape — 100% Leather Long Gloves, Zara PDP pattern: hero editorial photo, price+discount, color swatches, minimal description, Complete your look rail, accordions, Zara — Women's Accessories SALE listing page scrape (stealth-fetch) (+1 more)

### Community 72 - "Messages.tsx"
Cohesion: 0.27
Nodes (9): CATEGORY_LABEL, CATEGORY_STYLE, ContactMessage, Messages(), deleteMessage(), load(), reportFailure(), setRead() (+1 more)

### Community 73 - "AdminApi"
Cohesion: 0.14
Nodes (13): AdminApi, convert(), _detail(), lan_ip(), main(), make_handler(), Phone -> PC -> Savvy In Teal media library. Run this on the PC. Anyone on the…, Readable message from an API error body. FastAPI returns 422 validation… (+5 more)

### Community 74 - "payments.py"
Cohesion: 0.15
Nodes (13): OrderItem, Order and OrderItem ORM models., A single line item within an `Order`., AsyncSession, BackgroundTasks, post, Request, Razorpay webhook — server-authoritative order payment status. The browser's… (+5 more)

### Community 75 - "Backend Python dependency manifest (requirements.txt)"
Cohesion: 0.32
Nodes (8): Backend Python dependency manifest (requirements.txt), bcrypt used directly (not via passlib) — security primitives must never be hand-rolled, app.services.description_analyzer module (textstat consumer), FastAPI/SQLAlchemy/asyncpg/Celery core backend stack, python-multipart pinned — required at runtime for Starlette UploadFile/Form parsing on media-library upload endpoint, qrcode added for alphanumeric coupon codes (python-barcode is EAN13/UPCA numeric-only), setuptools pinned <81 so optional textstat path works; Flesch approximation fallback if unavailable, Media-library uploads volume (app/routers/media.py) persisted outside Postgres

### Community 76 - "test_routers_customers.py"
Cohesion: 0.46
Nodes (7): AsyncClient, asyncio, Tests for /api/customers (admin-only customer directory)., test_list_customers_as_admin(), test_list_customers_as_customer_403(), test_list_customers_never_leaks_password_hash(), test_list_customers_unauthenticated_401()

### Community 77 - "AsyncClient"
Cohesion: 0.32
Nodes (7): AsyncClient, asyncio, Integration tests for /api/recommendation/* endpoints. Internal back-office…, test_recommendation_rejects_non_admin(), test_recommendation_requires_admin(), TestDescriptionAnalyzerEndpoint, TestSchemaInspectorEndpoint

### Community 78 - "Semantic Extraction"
Cohesion: 0.36
Nodes (8): Corpus Detection, Document Files, Image Files, Paper Files, Semantic Extraction, Video Files, Video Transcription, Whisper Model

### Community 79 - "FranceLuxe — Hair Accessories collection page scrape"
Cohesion: 0.25
Nodes (8): Accessorize London — Bags category listing page scrape, Accessorize faceted filters: Colour, Price, Occasion, Product type + sort dropdown + pagination, Build Prompt: Luxury Hair Accessories E-Commerce Site (FranceLuxe-style), FranceLuxe-style multi-brand hair-accessories storefront blueprint (Shopify native or headless + faceted search), FranceLuxe — Hair Accessories collection page scrape, FranceLuxe faceted filters: Brand, Product type, Color (80+), Price, Size, Material, FranceLuxe mega-menu nav: New/Bestsellers/Hair Accessories/Home & Body/Brands/Sale with promo image tiles, FranceLuxe product card: hover-swap image, toggle swatches, vendor name, price range, View full details CTA

### Community 80 - "media.py"
Cohesion: 0.23
Nodes (12): delete_media(), list_media(), MediaItem, BaseModel, delete, get, Path, post (+4 more)

### Community 81 - "razorpay.py"
Cohesion: 0.24
Nodes (11): init_razorpay_payment(), post, Create a Razorpay payment order for an unpaid prepaid order. The Key Secret…, _basic_auth(), create_razorpay_order(), Decimal, Razorpay payment integration (server-side). The Key Secret is read from config…, Create a Razorpay order for ``total`` (INR, paise = total*100). Returns… (+3 more)

### Community 82 - "Savvy In Teal — E-Commerce Test Bed README"
Cohesion: 0.25
Nodes (8): frontend/README.md (create-next-app default), Standard create-next-app boilerplate: npm run dev, next/font Geist, Vercel deploy links, Savvy In Teal — E-Commerce Test Bed README, Podman Desktop chosen over Docker Desktop for local infra (OSI-open-source license requirement), Repository structure (frontend / backend / docker-compose.yml), Project roadmap (Phase 1 calculators, Phase 2 eval dashboard, Phase 3 ops tooling, Later: LLM agents/Celery), Savvy In Teal storefront (hair accessories & jewellery brand), savvyarchitect.md (project root roadmap notes, referenced but not in this chunk)

### Community 83 - "track-order/page.tsx"
Cohesion: 0.29
Nodes (4): Order, OrderItem, STATUS_LABEL, TrackOrderView()

### Community 84 - "Customers.tsx"
Cohesion: 0.23
Nodes (10): Address, Customer, Customers(), deleteCustomer(), load(), reportFailure(), saveEdit(), toggleBlock() (+2 more)

### Community 85 - "bulk_generate"
Cohesion: 0.26
Nodes (5): bulk_generate(), Pattern-based SKU generation for the Inventory Agent. Format:…, Generate `count` unique SKUs from a spec dict with brand/category/size keys.…, Unit tests for app.services.sku_generator (pure functions, no I/O)., TestBulkGenerate

### Community 86 - "routers/inventory.py"
Cohesion: 0.24
Nodes (12): generate_barcode(), generate_skus(), post, Response, Inventory generator endpoints (Inventory Agent tools)., Bulk-generate SKUs from a brand/category/size spec., Generate a UPC-A or EAN-13 barcode image, returned as raw PNG or SVG bytes., BarcodeRequest (+4 more)

### Community 87 - "compute_ean13_checksum"
Cohesion: 0.33
Nodes (4): compute_ean13_checksum(), Compute the EAN-13 checksum digit for a 12-digit code. Odd positions (1st, 3rd,…, Unit tests for app.services.barcode_generator (pure functions, no I/O)., TestComputeEan13Checksum

### Community 88 - "generate_ean13"
Cohesion: 0.36
Nodes (3): generate_ean13(), Generate an EAN-13 barcode (PNG + SVG) from a 12-digit code. Returns: dict with…, TestGenerateEan13

### Community 89 - "example_tasks.py"
Cohesion: 0.40
Nodes (4): ping(), Stub Celery tasks proving the task queue wiring works. Real agent tasks…, Trivial task used to prove Celery task registration works end-to-end., task

### Community 91 - "caveman-mode-tracker hook (intercepts /caveman-stats)"
Cohesion: 0.50
Nodes (5): caveman-mode-tracker hook (intercepts /caveman-stats), caveman-stats (real session token receipts), hooks/caveman-mode-tracker.js, caveman-stats skill (delivered by hook, no model computation), hooks/caveman-stats.js

### Community 92 - "Caveman Stats README"
Cohesion: 0.67
Nodes (4): caveman-mode-tracker.js hook, caveman-stats.js hook, Caveman Stats README, Caveman Stats — Session Token Report

### Community 93 - "Graph Query"
Cohesion: 0.50
Nodes (4): BFS Traversal, Graph Query, Token Budget, Vocabulary Expansion

### Community 94 - "Graph Node"
Cohesion: 0.50
Nodes (4): Graph Explain, Graph Node, Node ID Format, Source Location

### Community 118 - "Clustering"
Cohesion: 0.67
Nodes (3): Cluster-Only Mode, Clustering, Community Detection

### Community 119 - "Incremental Update"
Cohesion: 0.67
Nodes (3): Extraction Caching, Incremental Update, Manifest File

### Community 129 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 130 - "create_app"
Cohesion: 0.32
Nodes (7): create_app(), Construct and configure the FastAPI application instance., _clear_settings_cache(), fixture, App-construction guards: /docs, /redoc, /openapi.json must not be publicly…, test_docs_disabled_in_production(), test_docs_enabled_outside_production()

### Community 131 - "Ponytail Help"
Cohesion: 0.25
Nodes (7): Configure Default Mode, Deactivate, Levels, More, Ponytail Help, Skills, Update

### Community 141 - "Photo uploader — phone → PC → media library"
Cohesion: 0.29
Nodes (6): Auth, Format choice, Photo uploader — phone → PC → media library, Run it, What it does to each photo, Why the PC and not the phone browser

### Community 142 - "caveman-help"
Cohesion: 0.33
Nodes (5): caveman-help, Example output, How to invoke, See also, What it does

### Community 143 - "caveman-review"
Cohesion: 0.33
Nodes (5): caveman-review, Example output, How to invoke, See also, What it does

### Community 144 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 145 - "_load_catalog_via_tsx"
Cohesion: 0.50
Nodes (4): _load_catalog_via_tsx(), Write a tiny TS script that imports the catalog and prints JSON., Run the dumper with tsx and parse its stdout as JSON., _write_dumper()

### Community 146 - "graphify reference: add a URL and watch a folder"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 147 - "graphify reference: commit hook and native CLAUDE.md integration"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

### Community 148 - "graphify reference: incremental update and cluster-only"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

### Community 149 - "client_ip"
Cohesion: 0.67
Nodes (3): client_ip(), Request, Best-effort client IP. Reads request.client.host, not the X-Forwarded-For…

## Ambiguous Edges - Review These
- `Transparent or white background field` → `Savvy In Teal logo (small variant)`  [AMBIGUOUS]
  frontend/public/brand/logo-sm.png · relation: references
- `Notable ambiguity: the brand name 'Savvy In Teal' implies a teal color identity, but no teal/blue-green hue is actually visible anywhere in the logo artwork itself (palette is pink/white/green/gold) - teal may be used elsewhere in the site's UI theme instead of the logo mark` → `Savvy In Teal brand logo (WebP) - elegant gold script wordmark 'Savvy In Teal' overlaid on a pink, white and green watercolor floral bouquet, transparent background`  [AMBIGUOUS]
  frontend/public/brand/logo.webp · relation: raises_question_about

## Knowledge Gaps
- **289 isolated node(s):** `metadata`, `metadata`, `metadata`, `metadata`, `CollectionPageProps` (+284 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 855 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **27 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Transparent or white background field` and `Savvy In Teal logo (small variant)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `Notable ambiguity: the brand name 'Savvy In Teal' implies a teal color identity, but no teal/blue-green hue is actually visible anywhere in the logo artwork itself (palette is pink/white/green/gold) - teal may be used elsewhere in the site's UI theme instead of the logo mark` and `Savvy In Teal brand logo (WebP) - elegant gold script wordmark 'Savvy In Teal' overlaid on a pink, white and green watercolor floral bouquet, transparent background`?**
  _Edge tagged AMBIGUOUS (relation: raises_question_about) - confidence is low._
- **Why does `get_settings()` connect `get_settings` to `create_app`, `env.py`, `orders.py`, `dependencies/auth.py`, `payments.py`, `events.py`, `db.py`, `razorpay.py`, `conftest.py`, `routers/auth.py`, `main.py`, `email.py`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Why does `User` connect `User` to `test_routers_auth.py`, `orders.py`, `dependencies/auth.py`, `Base`, `db.py`, `conftest.py`, `routers/auth.py`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `require_admin()` connect `User` to `orders.py`, `dependencies/auth.py`, `routers/pricing.py`, `events.py`, `db.py`, `media.py`, `routers/coupons.py`, `routers/inventory.py`, `main.py`, `routers/recommendation.py`, `Product`, `categories.py`, `contact.py`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `metadata`, `metadata`, `metadata` to the rest of the system?**
  _289 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `test_routers_auth.py` be split into smaller, more focused modules?**
  _Cohesion score 0.06506849315068493 - nodes in this community are weakly interconnected._