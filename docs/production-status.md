# Production rollout status — 2026-10-03

Thaimora has a provisioned live backend. The public website launch remains incomplete.

## Actual external state

| Item | Verified state |
| --- | --- |
| Supabase organization | bravforcode, `vebihyveecbjubyiuysw`, Free |
| Dedicated database | `hpjmttoxomdhxxsourih`, thaimora-production, Singapore, PostgreSQL 17.11 |
| Project cost | Tool quoted $0/month per project; user explicitly confirmed; observed free plan, not unlimited service |
| Previous projects | graxia os (`kxundnceeuyjfittlgvo`) and clothes-brand-production (`qdfaappkvkqoyaldqtwd`) paused with explicit authorization and verified INACTIVE |
| Migrations | 14 hosted migrations including trigger ACL and managed public-grant hardening; MCP generates hosted timestamp versions |
| Edge API | `https://hpjmttoxomdhxxsourih.supabase.co/functions/v1/api`, deployed |
| Services | deliver-email deployed with private worker secret; Resend, Turnstile and scheduler unconfigured |
| Exchange rates | 30 ECB quote currencies via Frankfurter v2, as-of 2026-10-02; both actual sync reruns completed |
| Intended admin | Not created; email requested |
| Selected Vercel | Current bravforcode account, phirawit's projects, `team_OZhFXLaozxmZHvJu3NWvyzg9`; user selected this session |
| Vercel project | `prj_oXXaIFBSPJiwpZo2fgGZID0a2pTx`, verified assigned domain `thaimora.vercel.app` |
| Public frontend | Not deployed; latest deployment list empty at project verification |
| Hosting eligibility | Team remains Hobby; commercial eligibility unresolved; no upgrade/billing change |
| Operations/legal | No new remote/push or enabled schedules; approved EN/TH privacy/terms and legal contact absent |

Pausing the old projects interrupts their services. Do not restart automatically: the new projects consume the free active-project quota.

## Actual validation

Hosted rollback-only SQL passed: database.sql, review.sql, trigger-acl.sql. The DDL-free managed-grants.sql subset passed: anonymous private reads/writes denied, restricted columns retained, staff insert/update/delete and database audit preserved. Future CREATE TABLE and executable TRUNCATE probes were excluded from hosted DML calls; effective ACL metadata confirms TRUNCATE/MAINTAIN denial. The complete latest local SQL/restore suite remains unverified.

Owner-scoped defaults were inspected: postgres-created public tables deny anon and retain authenticated DML; supabase_admin defaults were deliberately left unchanged. Every new migration must still review explicit grants and RLS.

Security advisors retain intentional RLS-helper warnings: five SECURITY DEFINER predicates callable by anon/authenticated. Private legacy-image archive also has INFO for RLS without policies, intentionally denying client access. Do not call this a clean advisor scan. References: [anon helper notice](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [authenticated helper notice](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [RLS without policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

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
