# anatomy.md

> Auto-maintained by OpenWolf. Last scanned: 2026-10-04T08:37:41.773Z
> Files: 275 tracked | Anatomy hits: 0 | Misses: 0

## ./

- `.gitattributes` — Git attributes (~12 tok)
- `.gitignore` — Git ignore rules (~78 tok)
- `AGENTS.md` — Project instructions (~378 tok)
- `DESIGN.md` — Design System: Thaimora (~2458 tok)
- `eslint.config.mjs` — ESLint flat configuration (~139 tok)
- `GEMINI.md` — OpenWolf (~8 tok)
- `next-env.d.ts` — / <reference types="next" /> (~85 tok)
- `next.config.ts` — Next.js configuration (~291 tok)
- `package-lock.json` — npm lock file (~100122 tok)
- `package.json` — Node.js package manifest (~541 tok)
- `playwright.config.ts` — Playwright test configuration (~173 tok)
- `playwright.live.config.ts` (~256 tok)
- `postcss.config.mjs` (~16 tok)
- `PRODUCT.md` — Product (~437 tok)
- `README.md` — Project documentation (~514 tok)
- `tsconfig.json` — TypeScript configuration (~192 tok)
- `vercel.json` (~66 tok)
- `vitest.config.ts` — Vitest test configuration (~94 tok)
- `wrangler.jsonc` (~43 tok)

## .claude/

- `settings.json` (~441 tok)

## .claude/rules/

- `openwolf.md` (~90 tok)

## .github/workflows/

- `backup.yml` — CI: Encrypted logical backup (~518 tok)
- `catalog.yml` — CI: Authorized catalog sync (~232 tok)
- `content.yml` — CI: Manual content sync (~318 tok)
- `deploy-vercel.yml` — CI: Gated Vercel production (~831 tok)
- `export.yml` — CI: Snapshot and optional rebuild (~440 tok)
- `verify.yml` — CI: Verify (~191 tok)

## .impeccable/

- `design.json` (~3986 tok)

## .impeccable/review/

- `capture-report.json` (~606 tok)
- `server-error.log` (~21516 tok)
- `server-output.log` (~0 tok)

## .impeccable/surfaces/

- `property-explorer.md` — Thaimora property explorer (~449 tok)

## docs/

- `assets-provenance.json` (~492 tok)
- `backend.md` — Backend implementation and operating runbook (~4525 tok)
- `broker-backend.md` — Broker subscription and listing contact relay — 2026-10-04 (~4353 tok)
- `broker-membership-and-contact.md` — ส่งมอบระบบนายหน้าและการติดต่อเจ้าของประกาศ — 4 ตุลาคม 2026 (~1831 tok)
- `build-preview-pois.mjs` — Declares project (~495 tok)
- `capture-review.mjs` — Capture a single batched visual-review round from the exported preview. (~820 tok)
- `content-automation.md` — Thaimora content automation — 2026-10-04 (~3445 tok)
- `deployment.md` — Production deployment — thaimora (~3485 tok)
- `fetch-assets.ps1` (~324 tok)
- `fetch-open-pois.mjs` — One bounded manual import. Never call public Overpass from visitor requests. (~1056 tok)
- `free-data.md` — Free source review — Phuket property project (~843 tok)
- `handover.md` — คู่มือส่งมอบ — Thaimora (~2014 tok)
- `open-data.md` — ข้อมูลสถานที่จาก OpenStreetMap (~369 tok)
- `production-recovery.md` — Production recovery (~2092 tok)
- `production-status.md` — Production rollout status — 2026-10-04 (~1930 tok)
- `verification.md` — Verification record — Thaimora (~1914 tok)

## docs/evidence/

- `backend-verification.txt` (~869 tok)
- `content-admin-http.json` (~412 tok)
- `content-automation-hosted.json` (~606 tok)
- `content-public-http.json` (~232 tok)
- `content-scheduler-configured.json` (~66 tok)
- `content-worker-http.json` (~220 tok)
- `feature-hosted-database.json` (~1182 tok)
- `feature-hosted-http.json` (~1503 tok)
- `hosted-database-verification.json` — Declares to (~3958 tok)
- `hosted-http-auth-smoke.json` (~464 tok)
- `hosted-import-counts.json` (~344 tok)

## docs/imports/

- `osm-phuket-source.json` (~131304 tok)

## docs/reviews/

- `broker-contact-review.md` — Broker membership and contact feature verification — 2026-10-04 (~2402 tok)
- `content-api-baseline.json` (~598 tok)
- `content-api-measured.json` (~1469 tok)
- `content-api-optimized.json` (~1470 tok)
- `content-automation-review.md` — Thaimora automation review — 2026-10-04 (~2040 tok)
- `finish-review.md` — Final visual review — 2026-10-03 (~531 tok)
- `production-source-review.md` — Production source review — 2026-10-03 (~744 tok)
- `ruflo-constraints.md` — Bounded Ruflo review (~226 tok)
- `source-review-final.md` — Final source review — 2026-10-03 (~419 tok)
- `spec-review-initial.md` — Independent spec review — initial findings (~839 tok)

## docs/superpowers/plans/

- `2026-10-03-thaimora-implementation-plan.md` — Thaimora — แผนพัฒนาและตรวจรับ (~4728 tok)

## public/data/

- `phuket-pois.json` (~11056 tok)

## public/maplibre/

- `LICENSE.txt` (~1496 tok)
- `maplibre-gl-shared.mjs` — MapLibre GL JS (~137506 tok)
- `maplibre-gl-worker-dev.mjs` — MapLibre GL JS (~10192 tok)
- `maplibre-gl-worker.mjs` — MapLibre GL JS (~5103 tok)
- `maplibre-gl.mjs` — MapLibre GL JS (~157394 tok)

## scripts/

- `backup-db.sh` (~2001 tok)
- `check-actions-budget.ts` — Declares main (~678 tok)
- `configure-backend.ps1` — Declares Protect (~2040 tok)
- `configure-content-scheduler.ps1` (~625 tok)
- `export-public-content.ts` — Declares main (~652 tok)
- `fix-export-locale.mjs` — Static exports share a root layout; emit the correct language before hosting. (~278 tok)
- `hosting-gate.test.ts` — Declares now (~619 tok)
- `import-pois.ts` — Exports importPois (~559 tok)
- `launch-evidence.example.json` (~162 tok)
- `launch-gate.ts` — files: main (~605 tok)
- `prepare-production-build.mjs` — root: parsed (~370 tok)
- `probe-content-api.ts` — API routes: GET (4 endpoints) (~910 tok)
- `production-command.mjs` — Exports site, configurationErrors, main (~2490 tok)
- `production-command.test.mjs` — Declares base (~1372 tok)
- `production-gate.mjs` — Declares live (~552 tok)
- `rebuild-target.test.ts` — Declares r (~1067 tok)
- `record-vercel-deployment.ts` — Declares main (~210 tok)
- `request-rebuild.ts` — Declares main (~463 tok)
- `smoke-content-admin.test.ts` — site: run (~2634 tok)
- `smoke-content-admin.ts` — Bounded actual HTTP/Auth verification. Synthetic draft fixtures never become public. (~2924 tok)
- `smoke-content-http.ts` — API routes: GET (8 endpoints) (~833 tok)
- `smoke-content-worker.ts` — main: signed, probe (~735 tok)
- `smoke-feature-endpoints.mjs` — Read-only checks against this project's authorized hosted functions only. (~1819 tok)
- `smoke-hosted.test.ts` — API routes: GET (3 endpoints) (~2065 tok)
- `smoke-hosted.ts` — Real HTTP checks against the explicitly selected backend. No provider/email calls. (~2692 tok)
- `sync-content.ts` — CLI and scheduler use the same private leases and atomic writes. (~318 tok)
- `sync-hotel-catalog.ts` — Declares main (~581 tok)
- `test-backup.sh` — Actual PG17 synthetic encrypted recovery; no hosted credentials or published ports. (~970 tok)
- `test-database.ps1` — Actual SQL checks against a labeled disposable local container. (~924 tok)
- `test-database.sh` (~416 tok)
- `vercel-ci.mjs` — root: run (~508 tok)

## scripts/lib/

- `db.ts` — Exports need, rest, upsertPreserving, runSync + 4 more (~915 tok)
- `export-safety.ts` — Exports privateData, unsafeExport (~413 tok)
- `public-pages.ts` — Exports publicPages (~257 tok)
- `rebuild-target.ts` — Exports assertAutomatedRebuildTarget, rebuildState, vercelDeploymentReceipt, vercelWorkflowRequest (~551 tok)

## src/app/

- `broker.css` — Styles: 18 rules, 1 media queries (~899 tok)
- `globals.css` — Styles: 100 rules, 11 vars (~11994 tok)
- `layout.tsx` — metadata (~381 tok)
- `not-found.tsx` — NotFound (~167 tok)
- `page.tsx` — metadata (~141 tok)
- `robots.ts` — Exports dynamic (~139 tok)
- `sitemap.ts` — Exports dynamic (~232 tok)

## src/app/admin/

- `page.tsx` — metadata (~105 tok)

## src/app/broker/

- `page.tsx` — metadata (~52 tok)

## src/app/broker/dashboard/

- `page.tsx` — metadata (~55 tok)

## src/app/credits/

- `page.tsx` — metadata (~53 tok)

## src/app/guide/

- `page.tsx` — metadata (~53 tok)

## src/app/owner/

- `page.tsx` — Owner membership page (noindex)

## src/app/owner/dashboard/

- `page.tsx` — Owner report dashboard (noindex)

## src/app/privacy/

- `page.tsx` — metadata (~107 tok)

## src/app/property/[slug]/

- `page.tsx` — generateStaticParams (~525 tok)

## src/app/terms/

- `page.tsx` — metadata (~110 tok)

## src/app/th/

- `page.tsx` — metadata (~171 tok)

## src/app/th/admin/

- `page.tsx` — metadata (~107 tok)

## src/app/th/broker/

- `page.tsx` — metadata (~51 tok)

## src/app/th/broker/dashboard/

- `page.tsx` — metadata (~54 tok)

## src/app/th/credits/

- `page.tsx` — metadata (~84 tok)

## src/app/th/guide/

- `page.tsx` — metadata (~82 tok)

## src/app/th/owner/

- `page.tsx` — Thai owner membership page (noindex)

## src/app/th/owner/dashboard/

- `page.tsx` — Thai owner report dashboard (noindex)

## src/app/th/privacy/

- `page.tsx` — metadata (~110 tok)

## src/app/th/property/[slug]/

- `page.tsx` — generateStaticParams (~279 tok)

## src/app/th/terms/

- `page.tsx` — metadata (~108 tok)

## src/components/

- `admin-map.tsx` — AdminMap — renders map — uses useRef, useState, useEffect (~848 tok)
- `admin.tsx` — AdminMap — renders chart — uses useState, useEffect (~17440 tok)
- `broker-admin.tsx` — membersSchema — renders form, table — uses useState, useEffect (~1586 tok)
- `broker-report.tsx` — ReportPanel: KPI, daily trend, per-listing and lead tables, status select, CSV export
- `broker.tsx` — destinationSchema — renders form — uses useState, useRef, useCallback, useEffect (~9448 tok)
- `content-automation.tsx` — ContentAutomation — renders table — uses useState, useEffect (~1407 tok)
- `content-freshness.tsx` — ContentFreshness (~509 tok)
- `content-page.tsx` — ContentPage — renders map — uses useState, useEffect (~3453 tok)
- `context.tsx` — Context — uses useContext, useRouter, useState, useEffect (~1946 tok)
- `explorer.tsx` — PropertyMap (~9051 tok)
- `header.tsx` — Header — renders map (~1100 tok)
- `inquiry.tsx` — InquiryButton — renders form, modal — uses useRef, useState, useEffect (~3150 tok)
- `map.tsx` — EMPTY_POIS — renders map — uses useRef, useState, useEffect (~4709 tok)
- `property-card.tsx` — PropertyCard (~954 tok)
- `property-detail.tsx` — amenityIcons — renders map — uses useEffect, useState (~3198 tok)
- `property-page.tsx` — PropertyPage — uses useState, useEffect (~585 tok)
- `source-notes.tsx` — SourceNotes (~596 tok)

## src/lib/

- `api.ts` — Exports liveMode, SearchScope, api, propertyQuery + 10 more (~1760 tok)
- `broker-api.ts` — Zod schemas: brokerConfigSchema, brokerProfileSchema, brokerMeSchema, galleryImage + 4 more (~1526 tok)
- `broker-auth.ts` — API routes: GET (2 endpoints) (~1198 tok)
- `broker-report.ts` — reportWindow, bangkokToday, fillDailySeries, formatResponseTime (pure, no network)
- `content-automation.ts` — Exports protectedSourceRecord (~79 tok)
- `demo.ts` — Exports demoPlaces, demoProperties, previewFX, demoPOIs (~1650 tok)
- `import.ts` — Exports parseCSV, parseImportRows, DuplicatePolicy, applyPreviewImport + 2 more (~2513 tok)
- `legal.ts` — Zod schemas: legalSchema (~184 tok)
- `live-content.ts` — Exports useLiveContent (~310 tok)
- `new-property.ts` — Exports newProperty (~216 tok)
- `pagination.ts` — Exports paginate (~130 tok)
- `performance.ts` — Exports markerFixtures (~183 tok)
- `pois.ts` — Zod schemas: point (~1526 tok)
- `preview.ts` — Exports previewFX, demoPlaces, demoPOIs (~398 tok)
- `property.ts` — API routes: GET (1 endpoints) (~3113 tok)
- `public-content-client.ts` — A tab-local cache for public editorial content only. Never use for offers or PII. (~2121 tok)
- `snapshot.ts` — Exports snapshots (~187 tok)
- `source-health.ts` — Upstream freshness is independent of a successful read of our public API. (~254 tok)
- `use-public-content.ts` — Expire events locally at their exclusive end time, including after a tab resumes. (~366 tok)

## supabase/

- `config.toml` (~131 tok)

## supabase/.temp/

- `cli-latest` (~3 tok)
- `linked-project.json` (~41 tok)

## supabase/functions/

- `deno.json` — Deno configuration (~23 tok)

## supabase/functions/_shared/

- `admin-input.ts` — API routes: GET (2 endpoints) (~524 tok)
- `api-path.ts` — Exports apiParts (~137 tok)
- `broker-api.ts` — API routes: GET (1 endpoints) (~4656 tok)
- `broker-billing.ts` — Exports STRIPE_VERSION, ObjectValue, record, objectId + 8 more (~1892 tok)
- `broker-report.ts` — reportWindow, leadPage, csvText, csvResponse; CSV is BOM-prefixed and formula-safe.
- `broker-webhook.ts` — API routes: GET (1 endpoints) (~938 tok)
- `contact-relay.ts` — API routes: GET (4 endpoints) (~2618 tok)
- `content-sync.ts` — Visitor routes never fetch upstream data. Only leased, fixed registry sources run here. (~3845 tok)
- `domain.ts` — API routes: GET (13 endpoints) (~4642 tok)
- `hosting.ts` — Reviewed observations only. Do not infer billing, rights or usage from a key. (~401 tok)
- `http.ts` — Exports fetchJson (~94 tok)
- `public-content.ts` — API routes: GET (2 endpoints) (~1270 tok)
- `runtime.ts` — API routes: GET (6 endpoints) (~1486 tok)
- `sources.ts` — Exports tatRows, normalizeTat, inBbox, normalizePoi, licensedOsmRecords (~886 tok)

## supabase/functions/api/

- `index.ts` — API routes: GET (4 endpoints) (~3732 tok)

## supabase/functions/deliver-contact/

- `index.ts` — API routes: GET (1 endpoints) (~417 tok)

## supabase/functions/deliver-email/

- `index.ts` — API routes: GET (1 endpoints) (~558 tok)

## supabase/functions/line-webhook/

- `index.ts` — API routes: GET (1 endpoints) (~310 tok)

## supabase/functions/stripe-webhook/

- `index.ts` — Declares safe (~137 tok)

## supabase/functions/sync-content/

- `index.ts` — API routes: GET (2 endpoints) (~514 tok)

## supabase/migrations/

- `202610030001_initial.sql` — SQL: tables: public, public, public, public, 2 alter(s), 6 function(s) (~4247 tok)
- `202610030002_policies.sql` — SQL: 1 function(s) (~150 tok)
- `202610030003_search.sql` — SQL: 2 function(s) (~1102 tok)
- `202610030004_sources_settings.sql` — SQL: tables: public, 3 alter(s) (~163 tok)
- `202610030005_publication_guards.sql` — SQL: 1 function(s) (~486 tok)
- `202610030006_search_filters.sql` — SQL: 1 function(s) (~1306 tok)
- `202610030007_storage.sql` — Hosted Supabase owns storage schema. Standalone SQL tests deliberately do not pretend to test Storage. (~474 tok)
- `202610030008_stats.sql` — SQL: 2 function(s) (~283 tok)
- `202610030009_public_columns.sql` (~120 tok)
- `202610030010_review_fixes.sql` — Independent review corrections; source/rights checks remain server-enforced. (~4750 tok)
- `202610030011_atomic_admin.sql` — All dependent admin edits succeed or roll back together. (~1864 tok)
- `20261003124252_safe_public_image_metadata.sql` — Public Storage object-info returns user_metadata. Never put private rights evidence there. (~764 tok)
- `20261003142657_revoke_internal_trigger_execute.sql` — Trigger functions are invoked by table triggers, never through the public RPC API. (~138 tok)
- `20261003145239_harden_managed_public_grants.sql` — Managed Supabase defaults can grant ALL before the application's grants. (~593 tok)
- `202610040001_content_automation.sql` — Private bounded ingestion; public clocks exclude expired events without deleting history. (~6147 tok)
- `202610040002_content_reconciliation.sql` — Correct source snapshot withdrawal, restore approved reappearances and atomic admin automation release. (~2246 tok)
- `202610040003_signed_content_scheduler.sql` — Managed pg_net queue grants cannot be changed by the tenant owner. Never queue a permanent bearer. (~800 tok)
- `202610040004_content_snapshot.sql` — One stable database statement keeps public data and revision coherent. (~507 tok)
- `202610040005_content_revision_safeupdate.sql` — PostgREST sessions enforce pg-safeupdate; update only the singleton revision row. (~248 tok)
- `202610040006_broker_subscription.sql` — Broker identities and payment facts are private; client claims never grant access. (~6788 tok)
- `202610040007_contact_relay.sql` — Inquiries notify only the listing's privately assigned, consenting recipient. (~5987 tok)
- `202610040008_contact_scheduler.sql` — OFF until real accounts are configured. Queued auth is short-lived, never a bearer. (~1555 tok)
- `202610040009_contact_preferences_upsert.sql` — PostgreSQL checks proposed INSERT rows before ON CONFLICT selects the linked row. (~774 tok)
- `202610270001_owner_accounts.sql` — Owners reuse broker entitlement; owner approval required by default; pending owners cannot start Checkout.
- `202610270002_broker_reports.sql` — Report RPCs are security-definer and trust only the JWT-derived actor; first_response_at set by trigger, not backfilled.

## supabase/operations/

- `content-scheduler.sql` — Configured through service-role-only configure_content_scheduler after worker deployment. (~183 tok)
- `email-scheduler.sql` — SQL: tables: private, 1 alter(s), 3 function(s) (~1273 tok)

## tests/e2e/

- `flows.spec.ts` — Declares analytics (~1287 tok)
- `map.spec.ts` — Declares failures (~456 tok)
- `review-flows.spec.ts` — Declares amenity (~684 tok)

## tests/fixtures/

- `live-snapshot.json` (~287 tok)

## tests/frontend/

- `broker.playwright.config.ts` (~214 tok)
- `broker.spec.ts` — ",async route=>{const path=new URL(route.request().url()).pathname.split("/mock-api")[1];calls.push(path);if(path==="/v1/broker/config")return rout... (~3706 tok)
- `content-freshness.config.ts` (~197 tok)
- `content-freshness.spec.ts` — ", async route => { (~1446 tok)
- `material-fixes.spec.ts` — ", async (route) => { (~3728 tok)
- `material-fixes.test.ts` — Declares id (~1711 tok)
- `owner.spec.ts` — Owner dashboard fit at 360/390/1024/1440 px; CSV download; membership copy
- `playwright.config.ts` — Playwright test configuration (~224 tok)

## tests/integration/

- `api-path.deno.ts` — Declares equal (~460 tok)
- `backup-fixture.sql` (~264 tok)
- `boundaries.test.ts` — Declares row (~1577 tok)
- `broker-billing.deno.ts` — ObjectValue: equal, rejects, subscription + 4 more (~3031 tok)
- `broker-contact.sql` — Hosted-safe synthetic assertions. Every named fixture/configuration change rolls back. (~4358 tok)
- `broker-owner.sql` — Owner account kind and approval rule; rolls back.
- `broker-report-api.test.ts` — Report window, lead page and CSV helper contracts.
- `broker-reports.sql` — Report RPC totals, lead status and response time; rolls back.
- `contact-preferences-upsert.sql` — Regression for actual 23514: INSERT checks precede ON CONFLICT UPDATE. (~600 tok)
- `contact-relay.deno.ts` — API routes: GET, DELETE (5 endpoints) (~2939 tok)
- `content-automation.sql` — Safe on the hosted database: all named fixtures/configuration changes roll back. (~3477 tok)
- `content-pagination.deno.ts` — equal: database, rejects (~1493 tok)
- `content-snapshot.sql` — Read-only assertions inside a rollback transaction; no production fixture writes. (~550 tok)
- `content-sync.deno.ts` — API routes: GET (2 endpoints) (~2840 tok)
- `database.sql` (~1357 tok)
- `email-scheduler-model.sql` — Synthetic interfaces only: NOT real Vault encryption, Cron or pg_net HTTP execution. (~382 tok)
- `email-scheduler.sql` (~1159 tok)
- `email-worker.test.ts` — API routes: GET (2 endpoints) (~1532 tok)
- `export-content-pages.test.ts` — API routes: GET (15 endpoints) (~1227 tok)
- `export-safety.test.ts` — Declares token (~344 tok)
- `gates.test.ts` — Declares script (~321 tok)
- `local-bootstrap.sql` — SQL: tables: auth, 1 function(s) (~350 tok)
- `managed-grants.sql` — Synthetic privilege regression against managed-default ALL grants. (~2105 tok)
- `osm-source.test.ts` — Declares extract (~322 tok)
- `pagination.sql` (~804 tok)
- `poi-import-batch.test.ts` — API routes: GET (2 endpoints) (~1427 tok)
- `public-content-http.deno.ts` — API routes: GET (7 endpoints) (~1743 tok)
- `recovery.sql` — Only synthetic recovery: verifies archived private evidence and its actual restored grants. (~267 tok)
- `rest-response.test.ts` (~455 tok)
- `restore-verification.sql` — Declares grants (~551 tok)
- `review-contracts.test.ts` — Declares row (~585 tok)
- `review.sql` — Synthetic local assertions; every fixture is rolled back, never launch data. (~1666 tok)
- `storage-bootstrap.sql` — Minimal SQL model of Storage tables; not a Supabase Storage server/HTTP test. (~239 tok)
- `storage.sql` — Tests modeled Storage RLS and migration scrubbing; actual hosted object-info UAT remains required. (~849 tok)
- `trigger-acl.sql` — All fixtures remain within this rolled-back transaction, including hosted runs. (~1274 tok)

## tests/live/

- `admin-contract.spec.ts` — ", async (route) => { (~2550 tok)
- `api-contract.spec.ts` — ", async (route) => { (~2131 tok)
- `image-privacy.spec.ts` — ", async (route) => { (~672 tok)

## tests/unit/

- `api.test.ts` — API routes: GET (6 endpoints) (~1286 tok)
- `broker-api.test.ts` — Declares config (~1440 tok)
- `broker-auth.test.ts` — API routes: GET (1 endpoints) (~1133 tok)
- `broker-report.test.ts` — reportWindow, bangkokToday, fillDailySeries, formatResponseTime, brokerReportSchema
- `content-automation.test.ts` (~202 tok)
- `live-content.test.ts` — Declares event (~226 tok)
- `pagination.test.ts` — Declares rows (~238 tok)
- `property.test.ts` — Declares rows (~1437 tok)
- `public-content-client.test.ts` — meta: client (~2853 tok)
- `review-contracts.test.ts` — API routes: GET (1 endpoints) (~1686 tok)
- `snapshot-compatibility.test.ts` — Declares row (~679 tok)
- `source-health.test.ts` — Declares source (~648 tok)
