# Graph Report - ecom-test-bed  (2026-09-08)

## Corpus Check
- 0 files · ~0 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2117 nodes · 4178 edges · 141 communities (96 shown, 13 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 159 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Auth Tokens & Tests
- Analytics & Fraud Events
- Database Models
- Storefront Product UI
- Inventory & SKUs
- Account & Verification UI
- Async DB Engine
- User Model
- Coupons API
- Barcode Generation
- Account & Admin Pages
- Order Models
- Media Uploads
- Auth Profile Endpoints
- Root Layout & Chrome
- Products API
- Categories
- Caveman Skill (agents)
- Homepage Content Schema
- Contact Messages API
- Customer Admin API
- Hero & Homepage Sections
- Policy Pages & Nav Config
- Description Analyzer Tests
- Faceted Filtering & Sort
- Refresh Token Rotation
- Caveman Skill (claude)
- Collection & Product Pages
- Admin Analytics Dashboard
- Product Schema Inspector Tests
- Header Nav & Mega Menu
- Product & Collection Schemas
- Pricing API Tests
- Orders & Razorpay Payments
- API Client & Coupon Admin
- Analytics Consent & Search
- Homepage Content API
- Catalog Content
- Analyzer Schemas
- Backend Config & Celery
- Inventory API Tests
- Returns & Order Admin UI
- Security & Token Service
- Admin Messages Screen
- Coupon Discount Service
- Pricing Schemas
- Recommendation API Tests
- Admin UI Screens
- Fraud Signal Admin UI
- Backend Product Adapter
- Order Tracking Page
- Customer Edit Form
- Inventory Schemas
- Admin Error Logs
- Pricing Calculations
- Health Endpoint Tests
- Order API Tests
- Coming Soon Page
- Auth Login Flow
- Product API Tests
- Coupon API Tests
- Description Readability Service
- Returns API Tests
- Contact API Tests
- Transactional Email Service
- Collections API Tests
- Razorpay Verify Binding Tests
- Alembic Migration Env
- Customer API Tests
- Auth Dependencies
- Health Endpoint
- Celery Tasks
- Frontend Dependencies
- Caveman Compress Init (agents)
- Caveman Compress Init (claude)
- ESLint Config
- PostCSS Config
- Tailwind Config
- Coupon Reference
- Background Tasks Ref
- TypeScript Config
- Brand Concept Image A
- Brand Concept Image B
- Brand Concept Image C
- Brand Image Asset
- Brand Identity Assets
- Ponytail Skill (claude)
- Storefront Editing Skill
- Cavecrew Skill
- Caveman Skill Definition
- Accessorize Research
- Ponytail Skill (agents)
- Brand Style Guide
- Content Editing Docs
- Docker Compose Stack
- Zara Research
- Backend Requirements
- France Luxe Research
- Project README
- Caveman Stats (claude)
- Caveman Stats (agents)
- Graphify Clustering
- Graphify Incremental Cache
- Graphify Analysis Concepts
- Graphify Edge Relations
- Graphify Tooling Features
- Graphify Corpus Detection
- Graphify Query Traversal
- Graphify Node Explain

## God Nodes (most connected - your core abstractions)
1. `apiFetch()` - 54 edges
2. `get_settings()` - 46 edges
3. `User` - 42 edges
4. `Base` - 38 edges
5. `SiteConfig` - 23 edges
6. `analyze_description()` - 21 edges
7. `useAuth()` - 20 edges
8. `decode_token()` - 20 edges
9. `hash_password()` - 19 edges
10. `Product` - 18 edges

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
Nodes (70): RefreshToken, _no_real_email(), test_billing_same_true_clears_billing(), test_each_login_opens_its_own_family(), test_get_request_does_not_require_csrf_header(), test_live_token_is_dead_after_a_replay_elsewhere(), test_login_does_not_leak_whether_email_exists(), test_login_succeeds_and_sets_cookies() (+62 more)

### Community 10 - "Analytics & Fraud Events"
Cohesion: 0.10
Nodes (40): AdClickFlag, CheckoutVelocityFlag, CouponAbuseFlag, EventCreate, EventSummary, FraudSummary, LocationCount, TopProduct (+32 more)

### Community 12 - "Database Models"
Cohesion: 0.08
Nodes (31): Base, AgentDecision, Collection, ContactMessage, InventorySnapshot, ProductVariant, Recommendation, UserEvent (+23 more)

### Community 13 - "Storefront Product UI"
Cohesion: 0.11
Nodes (26): SpecimenRangesProps, AccordionSectionProps, CrossSellRailProps, ImageGalleryProps, PriceBlockProps, ProductCardProps, ProductDetailProps, VariantSelectorProps (+18 more)

### Community 14 - "Inventory & SKUs"
Cohesion: 0.08
Nodes (20): TestBulkGenerate, TestGenerateSku, generate_barcode(), generate_skus(), bulk_generate(), generate_sku(), _validate_segment(), post (+12 more)

### Community 15 - "Account & Verification UI"
Cohesion: 0.10
Nodes (32): Status, Order, VerifyEmail(), OrderHistory(), submitReturn(), CategoryManager(), add(), authError() (+24 more)

### Community 16 - "Async DB Engine"
Cohesion: 0.09
Nodes (27): ErrorLoggingMiddleware, ErrorLog, ErrorLogRead, create_engine(), get_db_session(), require_admin(), _write_log(), clear_error_logs() (+19 more)

### Community 17 - "User Model"
Cohesion: 0.12
Nodes (28): User, normalize_email(), create_admin(), admin_client(), admin_user(), _clear_login_throttle(), client(), customer_client() (+20 more)

### Community 18 - "Coupons API"
Cohesion: 0.14
Nodes (31): CouponCreate, CouponEdit, CouponRead, CouponValidate, CouponValidateResponse, coupon_qr(), create_coupon(), delete_coupon() (+23 more)

### Community 19 - "Barcode Generation"
Cohesion: 0.11
Nodes (15): TestComputeEan13Checksum, TestGenerateEan13, TestGenerateUpca, compute_ean13_checksum(), generate_ean13(), generate_upca(), _render_barcode(), _validate_numeric_code() (+7 more)

### Community 2 - "Account & Admin Pages"
Cohesion: 0.06
Nodes (36): AuthFormProps, RequireAuthProps, Address, AuthContextValue, AuthError, AuthUser, ProfileUpdate, RazorpayConstructor (+28 more)

### Community 22 - "Order Models"
Cohesion: 0.11
Nodes (25): Order, OrderItem, ReturnRequest, ReturnRequestCreate, ReturnRequestRead, create_return_request(), list_return_requests(), _restock_items() (+17 more)

### Community 23 - "Media Uploads"
Cohesion: 0.11
Nodes (26): MediaItem, delete_media(), list_media(), _to_item(), upload_media(), _cleanup_uploaded_files(), _png_bytes(), test_upload_accepts_a_real_image_and_derives_its_own_extension() (+18 more)

### Community 24 - "Auth Profile Endpoints"
Cohesion: 0.12
Nodes (24): Address, ForgotPasswordRequest, LoginRequest, MessageResponse, ProfileUpdate, RegisterRequest, ResetPasswordRequest, UserRead (+16 more)

### Community 26 - "Root Layout & Chrome"
Cohesion: 0.12
Nodes (18): NewsletterFormProps, CartContextValue, CartItem, WishlistContextValue, RootLayout(), AddedToast(), CartDrawer(), Footer() (+10 more)

### Community 27 - "Products API"
Cohesion: 0.15
Nodes (24): Product, create_product(), delete_product(), get_product(), get_product_by_slug(), list_products(), _q(), update_product() (+16 more)

### Community 29 - "Categories"
Cohesion: 0.16
Nodes (22): Category, CategoryCreate, CategoryRead, CategoryUpdate, ReorderPayload, create_category(), delete_category(), list_categories() (+14 more)

### Community 3 - "Caveman Skill (agents)"
Cohesion: 0.06
Nodes (49): ValidationResult, benchmark_pair(), count_tokens(), main(), print_table(), main(), print_usage(), backup_dir_for() (+41 more)

### Community 30 - "Homepage Content Schema"
Cohesion: 0.12
Nodes (19): Meta, EditorialTile, FieldSpec, HomepageContent, QuickCta, SeoCategory, SeoFaq, ImageSpec (+11 more)

### Community 31 - "Contact Messages API"
Cohesion: 0.16
Nodes (20): ContactAdminRead, ContactCreate, ContactRead, create_contact_message(), delete_contact_message(), _get_message_or_404(), list_contact_messages(), update_contact_message() (+12 more)

### Community 32 - "Customer Admin API"
Cohesion: 0.16
Nodes (21): BlockRequest, CustomerEdit, CustomerRead, block_customer(), delete_customer(), _get_customer_or_404(), list_customers(), update_customer() (+13 more)

### Community 34 - "Hero & Homepage Sections"
Cohesion: 0.26
Nodes (14): RevealProps, SiteConfig, BackendCollection, HomepageContentOverride, HomePage(), CampaignBand(), EditorialTiles(), HeroBanner() (+6 more)

### Community 35 - "Policy Pages & Nav Config"
Cohesion: 0.13
Nodes (11): PolicyPageProps, PolicySection, NavItem, NavLink, StudioAddress, PolicyPage(), metadata, metadata (+3 more)

### Community 36 - "Description Analyzer Tests"
Cohesion: 0.16
Nodes (6): TestAnalyzeDescription, TestFallbackReadabilityWithoutTextstat, analyze_description(), Heuristically score a product description's LLM/recommendation readiness.…, Unit tests for app.services.description_analyzer (pure functions, no LLM call)., Covers the self-contained Flesch approximation used when `textstat` (or its…

### Community 38 - "Faceted Filtering & Sort"
Cohesion: 0.15
Nodes (16): ActiveFilters, FacetGroupProps, FilterSidebarProps, ProductGridProps, SortDropdownProps, FilterCounts, SortOption, FilterSidebar() (+8 more)

### Community 39 - "Refresh Token Rotation"
Cohesion: 0.18
Nodes (18): TokenReuseError, IssuedRefreshToken, issue(), purge_expired(), revoke_all_for_user(), revoke_family(), rotate(), AsyncSession (+10 more)

### Community 4 - "Caveman Skill (claude)"
Cohesion: 0.06
Nodes (49): ValidationResult, benchmark_pair(), count_tokens(), main(), print_table(), main(), print_usage(), backup_dir_for() (+41 more)

### Community 41 - "Collection & Product Pages"
Cohesion: 0.15
Nodes (13): CollectionPageProps, ProductPageProps, SeoDescriptionProps, CollectionPage(), ProductPage(), ProductDetail(), SeoDescription(), adaptCollection() (+5 more)

### Community 42 - "Admin Analytics Dashboard"
Cohesion: 0.20
Nodes (15): EventSummary, LocationCount, TopProduct, AdminApp(), newDraft(), Analytics(), attrNum(), attrStr() (+7 more)

### Community 43 - "Product Schema Inspector Tests"
Cohesion: 0.18
Nodes (9): TestInspectProductSchema, _find_missing(), _get_nested(), inspect_product_schema(), Validates a product dict against schema.org Product JSON-LD guidance. Fields…, Look up a possibly-nested field (e.g. "offers.price") in `product`. Returns…, Return the subset of `fields` that are missing or falsy in `product`., Validate `product` against schema.org Product required/recommended fields.… (+1 more)

### Community 46 - "Header Nav & Mega Menu"
Cohesion: 0.14
Nodes (11): HeaderProps, MegaMenuColumn, MegaMenuProps, MobileNavProps, Header(), commit(), onBreakpoint(), onScroll() (+3 more)

### Community 47 - "Product & Collection Schemas"
Cohesion: 0.19
Nodes (15): CollectionDetail, CollectionRead, ProductCreate, ProductRead, VariantCreate, VariantRead, get_collection(), list_collections() (+7 more)

### Community 49 - "Pricing API Tests"
Cohesion: 0.26
Nodes (8): TestBreakEvenEndpoint, TestMarginEndpoint, TestMarkupEndpoint, test_pricing_rejects_non_admin(), test_pricing_requires_admin(), AsyncClient, asyncio, Integration tests for /api/pricing/* endpoints. Internal back-office tooling --…

### Community 5 - "Orders & Razorpay Payments"
Cohesion: 0.08
Nodes (54): OrderAdminRead, OrderCreate, OrderItemCreate, OrderItemRead, OrderRead, RazorpayVerifyRequest, _authoritative_pricing(), create_order() (+46 more)

### Community 51 - "API Client & Coupon Admin"
Cohesion: 0.16
Nodes (12): Coupon, ContactPage(), handleSubmit(), EditCouponRow(), apiBaseUrl(), postRefresh(), readCookie(), refreshOnce() (+4 more)

### Community 52 - "Analytics Consent & Search"
Cohesion: 0.21
Nodes (12): SearchOverlayProps, ConsentState, EventType, TrackExtra, ConsentBanner(), choose(), PageViewTracker(), SearchOverlay() (+4 more)

### Community 55 - "Homepage Content API"
Cohesion: 0.23
Nodes (13): HomepageContent, HomepageContentRead, HomepageContentWrite, get_homepage_content(), _get_or_create(), update_homepage_content(), AsyncSession, BaseModel (+5 more)

### Community 57 - "Catalog Content"
Cohesion: 0.20
Nodes (11): Collection, getCollectionBySlug(), getProductBySlug(), getProductsByCollectionSlug(), px(), collections, products, nextConfig (+3 more)

### Community 58 - "Analyzer Schemas"
Cohesion: 0.27
Nodes (12): DescriptionAnalyzerRequest, DescriptionAnalyzerResponse, SchemaInspectorRequest, SchemaInspectorResponse, analyze_product_description(), inspect_schema(), post, BaseModel (+4 more)

### Community 6 - "Backend Config & Celery"
Cohesion: 0.06
Nodes (45): Settings, get_settings(), create_app(), _basic_auth(), create_razorpay_order(), razorpay_enabled(), verify_payment_signature(), verify_webhook_signature() (+37 more)

### Community 60 - "Inventory API Tests"
Cohesion: 0.30
Nodes (7): TestBarcodeEndpoint, TestSkuEndpoint, test_inventory_rejects_non_admin(), test_inventory_requires_admin(), AsyncClient, asyncio, Integration tests for /api/inventory/* endpoints. Internal back-office tooling…

### Community 62 - "Returns & Order Admin UI"
Cohesion: 0.17
Nodes (9): Order, OrderItem, ReturnRequest, addressLine(), ShippingDetail(), PAYMENT, PAYMENT_STYLE, STATUS (+1 more)

### Community 7 - "Security & Token Service"
Cohesion: 0.09
Nodes (46): TokenError, create_access_token(), create_refresh_token(), create_reset_token(), _create_token(), create_verify_token(), decode_token(), dummy_verify() (+38 more)

### Community 72 - "Admin Messages Screen"
Cohesion: 0.25
Nodes (8): ContactMessage, Messages(), deleteMessage(), load(), setRead(), toggleExpand(), CATEGORY_LABEL, CATEGORY_STYLE

### Community 73 - "Coupon Discount Service"
Cohesion: 0.36
Nodes (6): Coupon, compute_discount(), Decimal, A discount code, redeemable once per order at checkout., Coupon discount math — shared between the live validate-as-you-type endpoint…, Validate `coupon` against `subtotal` and return the discount amount. Raises:…

### Community 74 - "Pricing Schemas"
Cohesion: 0.43
Nodes (7): BreakEvenRequest, BreakEvenResponse, MarginRequest, MarginResponse, MarkupRequest, MarkupResponse, BaseModel

### Community 77 - "Recommendation API Tests"
Cohesion: 0.36
Nodes (3): TestDescriptionAnalyzerEndpoint, TestSchemaInspectorEndpoint, TestClient

### Community 8 - "Admin UI Screens"
Cohesion: 0.11
Nodes (35): EditCell, AdminBadge, AdminCategory, AdminDims, AdminProduct, AdminShow, AdminView, MediaItem (+27 more)

### Community 80 - "Fraud Signal Admin UI"
Cohesion: 0.25
Nodes (6): AdClickFlag, CheckoutVelocityFlag, CouponAbuseFlag, FraudSummary, CouponAbuseTable(), Fraud()

### Community 81 - "Backend Product Adapter"
Cohesion: 0.39
Nodes (5): BackendProduct, BackendProductVariant, adaptProduct(), adaptVariant(), asStringArray()

### Community 83 - "Order Tracking Page"
Cohesion: 0.29
Nodes (4): Order, OrderItem, TrackOrderView(), STATUS_LABEL

### Community 84 - "Customer Edit Form"
Cohesion: 0.29
Nodes (5): Address, Customer, EditCustomerForm(), oneLine(), inputCls

### Community 86 - "Inventory Schemas"
Cohesion: 0.47
Nodes (5): BarcodeRequest, SkuBulkRequest, SkuBulkResponse, BaseModel, Request/response schemas for the inventory router.

### Community 87 - "Admin Error Logs"
Cohesion: 0.40
Nodes (5): ErrorLogEntry, ErrorLogs(), clearAll(), load(), statusStyle()

### Community 9 - "Pricing Calculations"
Cohesion: 0.07
Nodes (25): TestBreakEven, TestMarkup, TestProfitMargin, calculate_break_even(), calculate_markup(), calculate_profit_margin(), break_even(), markup() (+17 more)

### Community 1 - "Order API Tests"
Cohesion: 0.08
Nodes (64): _make_coupon(), _make_tracked_product(), product_id(), _seed_order_payload_products(), test_admin_all_orders_still_includes_fraud_fields(), test_admin_order_bypasses_terms_requirement(), test_admin_order_creation_bypasses_throttle(), test_admin_order_creation_keeps_payload_user_id() (+56 more)

### Community 20 - "Auth Login Flow"
Cohesion: 0.14
Nodes (28): _clear_auth_cookies(), forgot_password(), login(), logout(), refresh(), register(), _set_auth_cookies(), verify_email() (+20 more)

### Community 25 - "Product API Tests"
Cohesion: 0.19
Nodes (26): _create(), test_collection_filter(), test_create_product(), test_create_product_as_customer_returns_403(), test_create_product_unauthenticated_returns_401(), test_delete_product(), test_delete_product_unauthenticated_returns_401(), test_duplicate_slug_returns_409() (+18 more)

### Community 28 - "Coupon API Tests"
Cohesion: 0.25
Nodes (24): _coupon_payload(), test_coupon_qr_requires_admin(), test_coupon_qr_returns_png(), test_create_coupon_as_admin(), test_create_coupon_as_customer_403(), test_create_coupon_duplicate_code_409(), test_create_coupon_invalid_discount_type_422(), test_create_coupon_percent_over_100_rejected() (+16 more)

### Community 33 - "Description Readability Service"
Cohesion: 0.12
Nodes (18): _readability_score(), _split_words(), check_keyword_density(), check_length(), check_readability(), count_syllables(), flesch_reading_ease_approx(), Heuristic scoring of product description text for LLM/recommendation readiness.… (+10 more)

### Community 44 - "Returns API Tests"
Cohesion: 0.32
Nodes (17): _make_delivered_order(), _make_tracked_product(), _make_untracked_product(), test_approve_paid_return_refunds_and_restocks(), test_approve_unpaid_cod_return_restocks_but_does_not_mark_refunded(), test_create_return_request_duplicate_pending_409(), test_create_return_request_on_delivered_order(), test_create_return_request_requires_delivered() (+9 more)

### Community 48 - "Contact API Tests"
Cohesion: 0.34
Nodes (16): _contact_payload(), test_admin_list_still_includes_ip_address(), test_delete_message_as_admin(), test_delete_message_as_customer_403(), test_list_contact_messages_as_admin(), test_list_contact_messages_requires_admin(), test_mark_message_read_as_admin(), test_submit_contact_message_invalid_category_422() (+8 more)

### Community 59 - "Transactional Email Service"
Cohesion: 0.20
Nodes (13): _send(), send_account_exists_email(), send_order_confirmation_email(), send_order_shipped_email(), send_password_reset_email(), send_verification_email(), Outbound email, provider-abstracted. EMAIL_DEV_STUB=true (the default) logs…, Order moved to 'shipped' with a courier/tracking number attached. (+5 more)

### Community 64 - "Collections API Tests"
Cohesion: 0.36
Nodes (10): _create_collection(), test_get_collection_404(), test_get_collection_by_slug(), test_list_collections(), test_list_collections_empty(), AsyncClient, asyncio, AsyncSession (+2 more)

### Community 66 - "Razorpay Verify Binding Tests"
Cohesion: 0.51
Nodes (9): _init_payment(), _make_prepaid_order(), test_verify_rejects_a_signature_replayed_from_a_different_order(), test_verify_rejects_when_init_was_never_called(), test_verify_succeeds_with_the_matching_razorpay_order_id(), AsyncClient, asyncio, AsyncSession (+1 more)

### Community 69 - "Alembic Migration Env"
Cohesion: 0.28
Nodes (8): do_run_migrations(), run_async_migrations(), run_migrations_offline(), run_migrations_online(), Connection, Run migrations in 'offline' mode. This configures the context with just a URL…, In this scenario we need to create an Engine and associate a connection with…, Run migrations in 'online' mode.

### Community 76 - "Customer API Tests"
Cohesion: 0.46
Nodes (7): test_list_customers_as_admin(), test_list_customers_as_customer_403(), test_list_customers_never_leaks_password_hash(), test_list_customers_unauthenticated_401(), AsyncClient, asyncio, Tests for /api/customers (admin-only customer directory).

### Community 85 - "Auth Dependencies"
Cohesion: 0.47
Nodes (6): optional_current_user(), require_current_user(), AsyncSession, Request, Resolve the signed-in user from the access-token cookie, or 401. The user is…, Same resolution as require_current_user, but returns None instead of 401. For…

### Community 88 - "Health Endpoint"
Cohesion: 0.40
Nodes (4): health_check(), get, Health check endpoint., Return a simple liveness signal for load balancers / uptime checks.

### Community 89 - "Celery Tasks"
Cohesion: 0.40
Nodes (4): ping(), task, Stub Celery tasks proving the task queue wiring works. Real agent tasks…, Trivial task used to prove Celery task registration works end-to-end.

### Community 11 - "Frontend Dependencies"
Cohesion: 0.05
Nodes (41): dependencies, @fontsource-variable/archivo, @fontsource-variable/fraunces, lucide-react, next, react, react-dom, devDependencies (+33 more)

### Community 21 - "TypeScript Config"
Cohesion: 0.07
Nodes (28): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+20 more)

### Community 40 - "Brand Identity Assets"
Cohesion: 0.14
Nodes (19): Blush Pink & Gold Botanical Color Palette, Savvy In Teal brand identity: feminine, romantic, boutique hair-accessories & jewellery aesthetic, Watercolor-style floral bouquet motif (pink peonies, blush roses, white roses, green foliage) overlaid on the wordmark, Logo color palette: gold/black script, blush-pink & white florals, muted green foliage on transparent ground - notably no teal hue despite the brand name, Large ('-lg') logo variant, likely intended for header/hero/high-resolution storefront placements, "Savvy In Teal" gold cursive script wordmark with black outline/drop-shadow, Logo color palette (gold, blush/dusty pink, sage green, white), Small-variant usage as favicon / compact nav-bar logo (+11 more)

### Community 45 - "Ponytail Skill (claude)"
Cohesion: 0.12
Nodes (18): Auto-clarity (inherited from caveman), caveman-commit (terse Conventional Commits generator), Auto-Clarity (always body for breaking changes/security/migrations/reverts), caveman-commit skill instructions, caveman-compress (compress memory files to save tokens), caveman-compress skill instructions (compression rules, process, boundaries), caveman-help skill instructions (modes, skills table, config), caveman (talk like smart caveman, terse response mode) (+10 more)

### Community 50 - "Storefront Editing Skill"
Cohesion: 0.13
Nodes (16): content/site.config.ts (ceiling of abstraction for config), frontend/content/catalog.ts (products, prices, images, collections), frontend/app/globals.css (:root color/theme tokens), frontend/app/layout.tsx (fonts), next.config.ts images.remotePatterns (new remote image hosts), frontend/content/site.config.ts (brand, announcement, nav, home, footer), Delete dead code immediately (rule 7: no commented-out blocks, no _old files), Karpathy code-style skill (ruthless simplicity, no speculative abstraction) (+8 more)

### Community 53 - "Cavecrew Skill"
Cohesion: 0.25
Nodes (15): cavecrew-builder Agent, cavecrew-investigator Agent, cavecrew-reviewer Agent, Cavecrew Decision Guide, cavecrew-builder subagent (surgical 1-2 file edit), cavecrew-investigator subagent (locate code, read-only), cavecrew-reviewer subagent (diff/file review), Cavecrew (decision guide, full instructions) (+7 more)

### Community 54 - "Caveman Skill Definition"
Cohesion: 0.20
Nodes (15): Caveman Commit — Terse Conventional Commits, Caveman Compress — Memory File Compression, Caveman Help — Quick Reference Card, Caveman Review — One-Line PR Comments, Caveman — Terse Response Mode, Terse Mode, caveman-review skill instructions (format, severity tags), Caveman Toolkit Repo README (+7 more)

### Community 56 - "Accessorize Research"
Cohesion: 0.13
Nodes (15): Accessorize brand story: est. 1984, affordable stackable accessories, sustainability & charity commitments, Accessorize-style storefront structural/functional blueprint (headless commerce + Next.js/Remix or Shopify Liquid), Accessorize homepage section order: hero, promo tiles, New In grid, lifestyle tiles, promo banners, SEO/FAQ block, footer, Accessorize information architecture: 6 mega-menu nav sections (New In/Bags/Jewellery/Accessories/Kids/Sale), Accessorize PDP pattern: gallery, price+MRP, Add to cart/Buy it now, accordions, customer care block, Accessorize customer support channel (contact form, support email, phone, hCaptcha), Accessorize policies: 15-day refund/exchange, India-only delivery, no gift wrap, order cancellation rules, Accessorize homepage layout: hero banner, New In grid, lifestyle tiles, long-form SEO/brand content, FAQ, internal-link footer (+7 more)

### Community 61 - "Ponytail Skill (agents)"
Cohesion: 0.27
Nodes (13): Ponytail Audit — Repo-Wide Over-Engineering Scan, Ponytail Debt — Shortcut Ledger, Ponytail Gain — Impact Scoreboard, Ponytail Help — Quick Reference Card, Ponytail Review — Over-Engineering Diff Review, Ponytail Tag Taxonomy (delete/stdlib/native/yagni/shrink), The Ladder (YAGNI → stdlib → native → dependency → one-line → minimum), ponytail-audit (whole-repo over-engineering audit) (+5 more)

### Community 63 - "Brand Style Guide"
Cohesion: 0.20
Nodes (12): Feminine, elegant, romantic/boutique visual brand style (wedding/gift-shop aesthetic), Logo color palette: metallic gold script, blush/dusty pink florals, white/cream florals, muted sage-green foliage, on a transparent/white background, Watercolor-style floral bouquet illustration (pink peonies/roses, white roses, green foliage) overlaid on the wordmark, Ambiguity: brand name includes the word "Teal" but no teal/turquoise color is visually present in the logo artwork itself, Gold cursive/calligraphic script wordmark reading "Savvy In Teal", Savvy In Teal (hair accessories & jewellery e-commerce brand), Soft, romantic color palette: blush/dusty pink florals, white accents, sage/muted green foliage, and metallic gold script text, on a transparent background, Watercolor-style floral illustration cluster of large pink peonies/roses, smaller white roses, and green leafy foliage/sprigs, positioned behind and around the wordmark (+4 more)

### Community 67 - "Content Editing Docs"
Cohesion: 0.20
Nodes (9): Rules the AI follows: edits go in content/ never hardcoded in components, alt text required, must run npm run build/test, keep diffs small, Three editable content files: site.config.ts, catalog.ts, globals.css palette, Copy-paste owner prompts (change price, add product, change homepage, rebrand, seasonal campaign), Image handling: Pexels CDN via px() helper in site.config.ts or public/, new hosts added to next.config.ts remotePatterns, Embedded suspicious instruction block ("read node_modules/next/dist/docs") — prompt-injection-like, flagged and not followed, Agent rules: read storefront-editing/karpathy skills first, verify with npm run build/test, content in content/ not components/, CLAUDE.md consists solely of an @AGENTS.md include directive, Editing this store with AI (docs/EDITING.md) (+1 more)

### Community 70 - "Docker Compose Stack"
Cohesion: 0.44
Nodes (9): docker-compose.yml (Postgres/Redis/RabbitMQ/backend/frontend/Caddy), backend service (built from ./backend), caddy service (caddy:2-alpine, sole publisher of ports 80/443), frontend service (built from ./frontend), postgres service (postgres:16-alpine), rabbitmq service (rabbitmq:3-management-alpine), redis service (redis:7-alpine), NEXT_PUBLIC_API_URL must be set as a build arg — NEXT_PUBLIC_* vars are inlined into the client bundle at build time (+1 more)

### Community 71 - "Zara Research"
Cohesion: 0.22
Nodes (9): PDP pattern: image gallery, price+discount%, quantity, Add to cart/Buy it now, Description/Details/More Info accordions, Zara-style minimalist editorial storefront blueprint (bespoke React/Next.js SPA, region/locale routing), Zara bot protection: interstitial iframe on plain HTTP GET, requires headless-Chromium stealth fetch, Zara PDP pattern: hero editorial photo, price+discount, color swatches, minimal description, Complete your look rail, accordions, Zara listing page pattern: masonry editorial grid, storewide ~40% flash-sale discount, minimal card (image+title+price), Accessorize PDP scrape — Black Fringe Shoulder Bag, Build Prompt: Fast-Fashion Accessories E-Commerce Site (Zara-style), Zara PDP scrape — 100% Leather Long Gloves (+1 more)

### Community 75 - "Backend Requirements"
Cohesion: 0.32
Nodes (8): Backend Python dependency manifest (requirements.txt), app.services.description_analyzer module (textstat consumer), FastAPI/SQLAlchemy/asyncpg/Celery core backend stack, Media-library uploads volume (app/routers/media.py) persisted outside Postgres, bcrypt used directly (not via passlib) — security primitives must never be hand-rolled, python-multipart pinned — required at runtime for Starlette UploadFile/Form parsing on media-library upload endpoint, qrcode added for alphanumeric coupon codes (python-barcode is EAN13/UPCA numeric-only), setuptools pinned <81 so optional textstat path works; Flesch approximation fallback if unavailable

### Community 79 - "France Luxe Research"
Cohesion: 0.25
Nodes (8): Accessorize faceted filters: Colour, Price, Occasion, Product type + sort dropdown + pagination, FranceLuxe-style multi-brand hair-accessories storefront blueprint (Shopify native or headless + faceted search), FranceLuxe faceted filters: Brand, Product type, Color (80+), Price, Size, Material, FranceLuxe mega-menu nav: New/Bestsellers/Hair Accessories/Home & Body/Brands/Sale with promo image tiles, FranceLuxe product card: hover-swap image, toggle swatches, vendor name, price range, View full details CTA, Accessorize London — Bags category listing page scrape, Build Prompt: Luxury Hair Accessories E-Commerce Site (FranceLuxe-style), FranceLuxe — Hair Accessories collection page scrape

### Community 82 - "Project README"
Cohesion: 0.25
Nodes (8): Standard create-next-app boilerplate: npm run dev, next/font Geist, Vercel deploy links, Repository structure (frontend / backend / docker-compose.yml), Project roadmap (Phase 1 calculators, Phase 2 eval dashboard, Phase 3 ops tooling, Later: LLM agents/Celery), Savvy In Teal storefront (hair accessories & jewellery brand), savvyarchitect.md (project root roadmap notes, referenced but not in this chunk), frontend/README.md (create-next-app default), Savvy In Teal — E-Commerce Test Bed README, Podman Desktop chosen over Docker Desktop for local infra (OSI-open-source license requirement)

### Community 91 - "Caveman Stats (claude)"
Cohesion: 0.50
Nodes (5): caveman-mode-tracker hook (intercepts /caveman-stats), hooks/caveman-mode-tracker.js, hooks/caveman-stats.js, caveman-stats (real session token receipts), caveman-stats skill (delivered by hook, no model computation)

### Community 92 - "Caveman Stats (agents)"
Cohesion: 0.67
Nodes (4): caveman-mode-tracker.js hook, caveman-stats.js hook, Caveman Stats — Session Token Report, Caveman Stats README

### Community 118 - "Graphify Clustering"
Cohesion: 0.67
Nodes (3): Cluster-Only Mode, Community Detection, Clustering

### Community 119 - "Graphify Incremental Cache"
Cohesion: 0.67
Nodes (3): Manifest File, Extraction Caching, Incremental Update

### Community 37 - "Graphify Analysis Concepts"
Cohesion: 0.11
Nodes (20): Surprising Connections, Suggested Questions, Hyperedge, Graph Health Check, God Nodes, Cross-Repo Merge, Monorepo Handling, Wiki Export (+12 more)

### Community 65 - "Graphify Edge Relations"
Cohesion: 0.20
Nodes (10): semantically_similar_to Relation, Deep Mode Extraction, implements Relation, cites Relation, calls Relation, references Relation, EXTRACTED Confidence Level, AMBIGUOUS Confidence Level (+2 more)

### Community 68 - "Graphify Tooling Features"
Cohesion: 0.22
Nodes (9): Token Reduction Benchmark, CLAUDE.md Integration, Watch Mode, Cost Tracking, URL Ingest, Post-Commit Hook, AST Extraction, Code Files (+1 more)

### Community 78 - "Graphify Corpus Detection"
Cohesion: 0.36
Nodes (8): Paper Files, Video Transcription, Corpus Detection, Whisper Model, Video Files, Image Files, Document Files, Semantic Extraction

### Community 93 - "Graphify Query Traversal"
Cohesion: 0.50
Nodes (4): Token Budget, Vocabulary Expansion, Graph Query, BFS Traversal

### Community 94 - "Graphify Node Explain"
Cohesion: 0.50
Nodes (4): Graph Explain, Source Location, Node ID Format, Graph Node

## Ambiguous Edges - Review These
- `Transparent or white background field` → `Savvy In Teal logo (small variant)`  [AMBIGUOUS]
  frontend/public/brand/logo-sm.png · relation: references
- `Notable ambiguity: the brand name 'Savvy In Teal' implies a teal color identity, but no teal/blue-green hue is actually visible anywhere in the logo artwork itself (palette is pink/white/green/gold) - teal may be used elsewhere in the site's UI theme instead of the logo mark` → `Savvy In Teal brand logo (WebP) - elegant gold script wordmark 'Savvy In Teal' overlaid on a pink, white and green watercolor floral bouquet, transparent background`  [AMBIGUOUS]
  frontend/public/brand/logo.webp · relation: raises_question_about

## Knowledge Gaps
- **202 isolated node(s):** `AccordionSectionProps`, `Money`, `Status`, `Order`, `AuthFormProps` (+197 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 724 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Transparent or white background field` and `Savvy In Teal logo (small variant)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `Notable ambiguity: the brand name 'Savvy In Teal' implies a teal color identity, but no teal/blue-green hue is actually visible anywhere in the logo artwork itself (palette is pink/white/green/gold) - teal may be used elsewhere in the site's UI theme instead of the logo mark` and `Savvy In Teal brand logo (WebP) - elegant gold script wordmark 'Savvy In Teal' overlaid on a pink, white and green watercolor floral bouquet, transparent background`?**
  _Edge tagged AMBIGUOUS (relation: raises_question_about) - confidence is low._
- **Why does `get_settings()` connect `Backend Config & Celery` to `Orders & Razorpay Payments`, `Alembic Migration Env`, `Security & Token Service`, `Async DB Engine`, `User Model`, `Auth Login Flow`, `Auth Profile Endpoints`, `Transactional Email Service`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Why does `apiFetch()` connect `Account & Verification UI` to `Account & Admin Pages`, `Admin UI Screens`, `Admin Messages Screen`, `Admin Analytics Dashboard`, `Fraud Signal Admin UI`, `API Client & Coupon Admin`, `Order Tracking Page`, `Customer Edit Form`, `Admin Error Logs`, `Returns & Order Admin UI`, `Homepage Content Schema`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `AccordionSectionProps`, `Money`, `Status` to the rest of the system?**
  _202 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Auth Tokens & Tests` be split into smaller, more focused modules?**
  _Cohesion score 0.0676056338028169 - nodes in this community are weakly interconnected._
- **Should `Analytics & Fraud Events` be split into smaller, more focused modules?**
  _Cohesion score 0.10104529616724739 - nodes in this community are weakly interconnected._