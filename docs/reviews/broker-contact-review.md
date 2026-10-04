# Broker membership and contact feature verification — 2026-10-04

This is a scoped feature handoff, not full production acceptance. The user confirmed **US$25/month (USD)**, immediate dashboard access after server-confirmed current payment, no normal signup approval, and contact initiated only by a visitor's inquiry to that listing's consenting recipient. Publication review remains separate from membership enrollment.

## Review and corrections

The independent read-only architecture reviewer reported no material blocker to deploying these functions with billing, LINE linking and delivery OFF. Review covered server-bound Price/customer/mode, raw-body webhook signatures, customer leases and canonical state, private listing/lead ownership, current recipient consent, official LINE linking and bounded retries. This conclusion is limited to the reviewed source and test evidence.

Corrections preserved during implementation include current-state payment reconciliation instead of trusting Checkout returns, server-only recipient assignment, frozen outbox payload with destination revalidation, Auth email-change checks, historical lead isolation after reassignment, test/live customer isolation and withdrawal after subscription expiry. Private frontend state now uses a session generation, clears on concurrent authorization failure and expiry/resume, rejects unsafe payment return destinations, and excludes account routes from optional analytics/referrer sharing. Final browser receipts must refer to the code after those changes.

The first hosted `broker-contact.sql` run failed with SQLSTATE **23514**: `INSERT ... ON CONFLICT` proposed a LINE-enabled row without a LINE user ID before updating an existing linked recipient. Forward migration `202610040009_contact_preferences_upsert.sql` inserts LINE disabled, then applies the requested flag only to the existing validated row. Migrations 06–08 were preserved unchanged. The rerun passed and fixture cleanup was checked. The failure remains recorded in the buglog rather than being replaced by a pass-only narrative.

## Verified evidence

| Check | Actual result | Evidence |
| --- | --- | --- |
| Frontend typecheck/lint and optimized preview before final nullable-proof followup | Passed;80 generated pages and79 HTML language checks | Archive `e5fe23fd2b025839`; explicit preview, production launch gates unchanged |
| Full unit suite before nullable-proof followup | 80/80 passed | Archive `fc7e5bbce267e771` |
| Final nullable-proof followup on current code | Enhanced existing broker API fixture:16/16 units, typecheck, lint and optimized preview build passed;80 generated pages/79 HTML language checks | Archive `8f7c8d6cba4f712b`;16 is a subset, not an additional suite count |
| Integration test suite | 36 tests passed independently; its earlier combined wrapper also contained an unrelated frontend type/unit failure | Archive `0b06eeda1e3cb4a9`; this is not an all-pass wrapper claim |
| Independent final backend tests | 25 Deno tests passed | Archive `3bdbc14d2245ae79` |
| Independent auth/API contract tests | 22 tests passed | Archive `72da4e5f487d4fba` |
| Backend scoped final lint/tests | 25 tests and 9 scoped lint targets passed after async mock fixes | Archive `2cb70e293f605972` |
| Edge function entry typechecks | Four entries passed | Archive `eebae667a5d9c4a7` |
| Hosted schema | Migrations 06, 07, 08 and forward 09 applied to `hpjmttoxomdhxxsourih` | Root migration receipts; source migration files |
| Hosted broker/contact SQL | `tests/integration/broker-contact.sql` rerun returned no error inside rollback transaction | Root hosted SQL receipt; synthetic tracked users/profile/outbox counts 0 afterward |
| Focused hosted preference upsert SQL | `tests/integration/contact-preferences-upsert.sql` returned no error inside `BEGIN`/`ROLLBACK` | Root hosted MCP receipt; no provider calls |
| Hosted safety/config | Monthly amount 2500, currency USD, no normal signup approval; billing OFF, delivery OFF; terms version not configured | Root hosted read-only verification |
| Function deployment | `api`, `stripe-webhook`, `line-webhook`, `deliver-contact` CLI deploy exited 0 | Archive `6dc74ff3ff7e6431` |
| Hosted function metadata | APIv7; Stripe/LINE/contact functionsv1 ACTIVE; custom authentication with `verify_jwt=false`; 23 hosted migrations including06–09 | Root actual metadata verification |
| Actual hosted HTTP | 18/18 read-only cases passed at `2026-10-04T08:13:53.739Z` | [feature-hosted-http.json](../evidence/feature-hosted-http.json); `scripts/smoke-feature-endpoints.mjs` |
| Corrected Chromium contract suite | 11/11 passed; no duplicate React key warnings; private state clears on403; account-route analytics fixture includes enabled GA4, prior consent and a LINE invitation token URL | Archive `c90accd3aa80e7ae`; `tests/frontend/broker.spec.ts` |
| Corrected-code captures | Thai mobile recruitment and English dashboard; dismissed cookie banner and one password section | [Thai mobile](../evidence/broker-recruitment-th-mobile.png), [English dashboard](../evidence/broker-dashboard-en.png) |
| Existing inquiry retry regression | 1/1 passed; consumed Turnstile token refreshed, idempotency key/form retained, required contact-sharing consent exercised | Archive `3342cd3a39bb619d` |

Sanitized [feature-hosted-database.json](../evidence/feature-hosted-database.json) records exact applied migration/source hashes, ACTIVE function versions/bundle hashes, deployment receipts and both rollback SQL results, including the original09 upsert failure/fix. Fresh read-only cleanup at08:28:04UTC found all tracked synthetic users/events and broker/contact jobs0, no published inventory, billing/delivery OFF and the agreed2500USD quote. No private credentials are in this artifact.

The initial browser run passed 8 cases (`9b9ba5a8921e2d0f`). A later 10-case run (`d963220146c235cf`) passed assertions but surfaced duplicate React key warnings; root corrected the key/session behavior afterward. An 11-case run (`a88931c44ceea764`) then failed a test selector because generic `getByRole("alert")` matched both Next's hidden route announcer and the application notice; private lead state had cleared correctly on403. The fixture now targets `.notice.error[role=alert]` and exercises optional analytics with actual prior consent and a LINE link-token URL. The final11/11 receipt and captures above supersede these earlier UI captures. Final type/lint/optimized-preview and80-unit reruns passed as shown above.

The earlier mixed wrapper's TS2345 photo error came from omitted `credit`/`sourceUrl` fields after nullable DTO normalization; explicit blank draft fields fixed it. Its unit failure reused one fetch `Response` for two calls; the mock now creates a fresh response for each call. The initial corrected type/lint/80-unit pass was `68338f1c0977f670`; final source passes are listed above. The agreed USD25 quote also remains visible when the backend is temporarily unavailable, while registration/billing/delivery flags stay disabled rather than inventing readiness.

The first invocation of the existing inquiry regression hit a1,000ms shell harness timeout (`ef7376ae2e3bd5ad`). The unchanged source test passed after a180,000ms background job allowance; this was a harness timeout, not an application failure or a provider operation.

A final source reviewer identified one private draft edge after these candidate receipts: staff may clear `publication.ownershipEvidence` or gallery `rightsEvidence` to SQLNULL. The client previously required strings and would reject that valid private response. Root now normalizes missing proof to empty draft-edit fields, preserving required UI/save/publication validation. The existing nullable API fixture was enhanced;16focused broker API tests, typecheck, lint and the current-code preview build passed in `8f7c8d6cba4f712b`. The reviewer confirmed read-only normalization and approved this followup. No new test count or backend deployment is implied; prior browser captures remain representative of the unchanged layout.

## Limits and activation

Offline provider tests above use mocked Stripe/email/LINE traffic and synthetic private fixtures. The actual hosted HTTP suite verified the public USD25/month quote with no approval and billing, broker registration, contact delivery and LINE linking OFF; unauthenticated private routes, a forged token and invalid worker authorization returned401. Stripe requests returned503 `billing_not_configured` and LINE requests503 `line_not_configured`. These are **OFF-state fail-closed checks**, not configured webhook-signature verification. Public POIs remained1868 and events0. The HTTP suite did not test an authenticated real broker, current Stripe payment or provider delivery.

No actual signup email, charge, contact send, LINE account link or partner account application was performed by the scoped backend test worker. Function deployment establishes available code, not real account integration or a public frontend launch. Customer/provider receipts, current backup recovery and intended-user UAT remain required.

See [membership/contact handoff](../broker-membership-and-contact.md) for the account checklist and [backend runbook](../broker-backend.md) for exact activation switches, private scheduler configuration, event/lease handling, provider deduplication limits and test-to-live migration. Existing legal, intended admin, real rights-approved inventory and commercial-hosting gates remain. No fastest/best or comprehensive production-ready claim follows from this evidence.
