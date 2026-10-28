# Production rollout status — 2026-10-04

Thaimora has a provisioned live backend. The public website launch remains incomplete.

## Actual external state

| Item | Verified state |
| --- | --- |
| Supabase organization | bravforcode, `vebihyveecbjubyiuysw`, Free |
| Dedicated database | `hpjmttoxomdhxxsourih`, thaimora-production, Singapore, PostgreSQL 17.11 |
| Project cost | Tool quoted $0/month per project; user explicitly confirmed; observed free plan, not unlimited service |
| Previous projects | graxia os (`kxundnceeuyjfittlgvo`) and clothes-brand-production (`qdfaappkvkqoyaldqtwd`) paused with explicit authorization and verified INACTIVE |
| Migrations | 19 hosted migrations including content automation, atomic snapshots and the PostgREST safeupdate revision fix; MCP generates hosted timestamp versions |
| Edge API | `https://hpjmttoxomdhxxsourih.supabase.co/functions/v1/api`, deployed |
| Services | deliver-email deployed with private worker secret; Resend, Turnstile and email scheduler unconfigured; private content scheduler active |
| Exchange rates | 30 ECB quote currencies via Frankfurter v2, as-of 2026-10-02; daily scheduled source checks succeeded on both projects at 2026-10-03 18:50 UTC |
| Intended admin | Not created; email requested |
| Selected Vercel | Current bravforcode account, phirawit's projects, `team_OZhFXLaozxmZHvJu3NWvyzg9`; user selected this session |
| Vercel project | `prj_oXXaIFBSPJiwpZo2fgGZID0a2pTx`, verified assigned domain `thaimora.vercel.app` |
| Public frontend | Not deployed; latest deployment list empty at project verification |
| Hosting eligibility | Team remains Hobby; commercial eligibility unresolved; no upgrade/billing change |
| Operations/legal | No new remote/push or enabled GitHub workflows; Supabase content schedule active; approved EN/TH privacy/terms and legal contact absent |

Pausing the old projects interrupts their services. Do not restart automatically: the new projects consume the free active-project quota.

## Actual validation

Hosted rollback-only SQL passed: database.sql, review.sql, trigger-acl.sql. The DDL-free managed-grants.sql subset passed: anonymous private reads/writes denied, restricted columns retained, staff insert/update/delete and database audit preserved. Future CREATE TABLE and executable TRUNCATE probes were excluded from hosted DML calls; effective ACL metadata confirms TRUNCATE/MAINTAIN denial. The complete latest local SQL/restore suite remains unverified.

Owner-scoped defaults were inspected: postgres-created public tables deny anon and retain authenticated DML; supabase_admin defaults were deliberately left unchanged. Every new migration must still review explicit grants and RLS.

Prior security advisors retained intentional RLS-helper warnings for five public predicates; the new public metadata/snapshot RPCs are also intentional. No fresh zero-warning advisor result is claimed. Private legacy-image archive also has INFO for RLS without policies, intentionally denying client access. Do not call this a clean advisor scan. References: [anon helper notice](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [authenticated helper notice](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [RLS without policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

Actual hosted HTTP/Auth smoke passed 13 cases, including publishable-key browsing, CORS, JWT rejection, nonstaff denial and staff access. Synthetic Auth user deletion and cascading membership cleanup were confirmed. See [HTTP/Auth evidence](evidence/hosted-http-auth-smoke.json). Actual Storage uploads, intended-user browser acceptance, inquiry/email delivery, entitled hotel-price calls and hosted encrypted recovery remain unverified. Never set readiness flags from fixtures or mocks.

## Data and evidence limits

No checked free source supplied 500 active Phuket listings with commercial republication rights. Valuation records/OSM buildings are not sale/rent inventory; authorized owner/broker CSV import is implemented. No invented property inventory is published.
The separately licensed OSM POI extract was imported successfully: 1868 published POIs and matching private source records. Actual hosted SQL confirms zero published properties, zero Auth fixtures and zero memberships after cleanup. See [import counts](evidence/hosted-import-counts.json). After pagination correction and API redeployment, actual HTTP returned all1868 Phuket and234 Koh Tao POIs with matching unique IDs. Six offline Deno pagination checks/site passed; count mismatches/oversized catalogs fail explicitly. Free affiliate applications do not establish Booking Demand/Agoda API entitlement. No provider requests or application messages have been sent.

| Evidence | Result and boundary |
| --- | --- |
| `1e0823e439748de4` / `6825b661e8f59fb5` | Five REST response regressions/site and source typecheck passed |
| `ae9ec926913eabc8` | Both actual FX reruns completed; older failed run records preserved |
| `085313977c3db548` / `6e640c280b5bf6c7` | Earlier synthetic PG17 encrypted restores passed before latest trigger/grant migrations |
| `ae6cdbd53578345e` / `9899f46dbe882a66` / `08b9fa6599603514` | Latest local SQL/inspection timed out on unresponsive Docker; no new pass |
| `02f0a4daf8e30b8a` / `3bb64c0914e3e5d0` | First HTTP smoke launch failed TS/CJS transform before network or fixture creation |

Two owned labelled local containers may remain; cleanup only after matching ownership labels. Do not restart the shared daemon or remove unrelated containers. Production npm audit previously zero; full audit retains five high development dependency findings. Secret files are ignored and owner-DACL protected.

To launch: resolve commercial hosting, supply admin/legal details, agree on data scope, finish hosted UAT/recovery, deploy and verify public URLs. Assigned domains are not proof of serving websites.

## Content automation verified — 2026-10-04

The private content worker and five forward migrations are deployed. A natural five-minute cron tick at2026-10-03 18:50UTC returnedHTTP200 with two claims, two completions and zero failures on each project. ECB conversion-reference and TAT metadata sources are checked daily. This is not real-time event availability: organizer and OSM sources remain OFF under the user's latest decision.

Public API content now uses one coherent database snapshot, bounded public projections and conditional ETags. The browser checks visible/online content every60seconds, retains the last successful data during failures and expires events locally; source-health labels distinguish browser checks from upstream checks. Normal manual saves remain protected until staff explicitly release automatic control.

Actual hosted tests passed seven admin cases, five signed-worker/replay cases and five public CORS/count/validator cases per site; synthetic users, memberships, events and exact fixture tombstones were removed. Frontend preview builds, unit and functional browser tests passed. These results do not establish an actual-user production acceptance or a public frontend deployment.

Evidence: [natural scheduler and source state](evidence/content-automation-hosted.json), [admin HTTP and cleanup](evidence/content-admin-http.json), [worker authorization](evidence/content-worker-http.json), [public HTTP](evidence/content-public-http.json), [measured API samples](reviews/content-api-optimized.json), [runbook](content-automation.md), [review and limitations](reviews/content-automation-review.md).

## Owner accounts, broker reports and local hardening — 2026-10-27

Hosted rollout is recorded below. This supersedes the 2026-10-04 count of five high development findings.

- Owner accounts: `broker_profiles.account_kind` (`broker` | `owner`), `/owner` and `/th/owner` routes. Owners use the same monthly membership and Stripe price as brokers. Owner listings need admin approval (`broker_config.owner_approval_required`, default on).
- Report dashboard for brokers and owners: 7/30/90-day KPIs, daily trend, per-listing results, lead status and first-response time, CSV export. Reports are security-definer RPCs with Asia/Bangkok day boundaries, a 365-day maximum range, and a 10,000-row lead export cap that returns an error instead of truncating.
- Admin lists return `truncated`; the admin inquiry export above 5,000 rows returns `422 export_limit_exceeded` instead of cutting rows silently.
- Dependency patch via non-breaking `npm audit fix --omit=dev`: next 16.3.8 → 16.4.3, zod 4.6.5 → 4.6.7, vite 8.3.2 → 8.3.5, rolldown 1.2.12 → 1.2.15, plus transitive `postcss`, `nanoid`, `@oxc-project/types`. `npm audit fix --force` was not run.
- Lockfile repair: npm 11.6 on this machine dropped 26 optional native entries (15 `@rolldown/binding-*`, 11 `vite/node_modules/lightningcss-*`) during the audit fix and every later lock-only write. Restored lightningcss entries from HEAD (versions unchanged); rolldown bindings at 1.2.15 with integrity from `npm view`. `npm ci` then installed `@rolldown/binding-win32-x64-msvc` 1.2.15.

### Hosted rollout on `hpjmttoxomdhxxsourih`

- Migrations `202610270001_owner_accounts` and `202610270002_broker_reports` applied. The 1000-listing guard in `broker_report` and its `broker_record_page_required` mapping were added before apply.
- `api` Edge Function deployed as v11 with `verify_jwt` false.
- Smoke: `GET /v1/broker/config` returned 200. `GET /v1/broker/reports/summary` and `/export` without a token returned 401. The authenticated 422 check (`invalid_export_kind`) was skipped because no test account was created.
- SQL state check: `account_kind`, `owner_approval_required` and `first_response_at` exist. Trigger `inquiry_first_response` exists. `broker_register` takes `p_kind`. The three report functions are executable by `service_role` only (anon 0, authenticated 0).
- Advisors (observed 2026-10-27 19:20 UTC):
  - New from this work: `function_search_path_mutable` on `private.broker_approval_satisfied`. Fixed by `supabase/migrations/202610270003_owner_approval_search_path.sql`, applied to hosted on 2026-10-28. Rerun the same day (06:24 UTC) no longer reports it; `proconfig` is `search_path=pg_catalog, private`. The remaining security findings are unchanged.
  - Pre-existing, not changed here: 7 SECURITY DEFINER helpers executable by `anon` and `authenticated` (documented as intentional); `pg_net` in `public`; RLS enabled without policies on 23 `private` tables (intentional, no client access); `admin_memberships` policy `member_self` initplan; 7 multiple-permissive-policy sets; 9 unused indexes and 17 unindexed foreign keys (INFO). Two unused indexes are on broker tables (`broker_listings_owner`, `inquiry_recipients_owner`). They need traffic data before any change.

### Local verification, 2026-10-28

Rerun after the `broker-api.ts` mapping and the migration guard were added. Rows not marked 2026-10-28 were not rerun.

| Command | Exit | Result |
| --- | --- | --- |
| `npm ci` | 0 | 2026-10-27; rolldown win32 binding present |
| `npm run typecheck` | 0 | 2026-10-28 |
| `npm run lint` | 0 | 2026-10-28 |
| `npm run test:unit` | 0 | 2026-10-28: 13 files, 85 tests |
| `npm run test:integration` | 0 | 2026-10-28: 10 files, 42 tests (TypeScript only) |
| `npm run build` | 0 | 2026-10-28: 84 static pages; `out/owner` and `out/th/owner` generated |
| `npx playwright test --config tests/frontend/broker.playwright.config.ts` | 0 | 2026-10-27 only: 17 tests, including owner pages at 360/390/1024/1440 px with no horizontal scroll. Not rerun |
| `npm run test:deployment` | 0 | 2026-10-28: 6 tests |
| `npm audit --omit=dev` | 0 | 2026-10-27: 0 vulnerabilities |
| `npm audit` (full) | 1 | 2026-10-27: 4 high, dev-only (sharp/undici via wrangler/miniflare). Fix needs breaking `--force`; accepted, not applied |
| `npm run production:check` | 1 | 2026-10-28: blocked by missing production environment variables (external gate) |

Not verified:

- SQL integration tests (`tests/integration/broker-owner.sql`, `broker-reports.sql`, `broker-contact.sql`) were not run: no Docker or psql locally, and no approval to run them against hosted.
- Migration `202610270003_owner_approval_search_path.sql` was applied to hosted on 2026-10-28 and the security advisor rerun no longer reports the search_path WARN.
- Stripe test-mode UAT for owners is not run. `BROKER_BILLING_ENABLED` stays off. Owner Checkout returns to the broker dashboard path (known limitation).
- `first_response_at` is set only for leads changed after the trigger exists; no backfill.
- `broker_report_leads` pages on `created_at` alone; leads with identical timestamps can be skipped across pages (accepted at current volume).
- `content-automation.tsx` ignores `truncated` for POIs and events.
- Edge functions `stripe-webhook`, `line-webhook`, `deliver-contact`, `deliver-outreach` and `sync-content` were not redeployed. They bundle `_shared` code, so compatibility with the changed shared files is unverified.
