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
