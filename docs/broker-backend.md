# Broker subscription and listing contact relay — 2026-10-04

The requested fee is **US$25 per month** (`2500` USD minor units). “Dollar” is configured as USD. A confirmed payment opens the broker dashboard immediately; broker enrollment has no staff approval step. Owner accounts (`account_kind = 'owner'`) also need staff approval before access opens while `owner_approval_required` is true (default); see [Owner accounts](#owner-accounts). Listing publication still requires staff review of ownership, content, images and safe coordinates.

Stripe billing, recipient delivery and LINE linking start **OFF**. No Stripe product, Price, customer, subscription or charge was created during implementation. No email, LINE message or provider application was sent. Real account end-to-end verification remains required before activation.

## Server contract

All endpoints use the existing Supabase Edge API base followed by `/v1`.

| Route | Behavior |
|---|---|
| `GET /broker/config` | Quote `{amountMinor:2500,currency:"USD",interval:"month"}`, actual billing readiness, terms version and optional LINE friend URL. |
| `POST /broker/register` | A server-validated, confirmed-email Supabase user accepts the configured terms version. Stores name, company and phone. `accountKind` is `broker` (default) or `owner`, fixed at first registration; any other value returns `422 invalid_account_kind`. Creates no staff role or paid status. |
| `GET /broker/me` | Own private profile, subscription dates/status and `{active,reason}` entitlement. |
| `POST /broker/checkout` | Hosted Stripe Checkout for exactly one configured US$25 monthly Price. No arbitrary Price, amount, customer or return URL from the browser. |
| `POST /broker/portal` | Stripe Customer Portal for the authenticated user's server-bound customer. Also available after membership expiration to repair/cancel billing. |
| `GET /broker/dashboard` | Paid, active user's own listing and lead summaries. |
| `GET /broker/reports/summary?from=&to=` | Paid, active user's KPI totals, daily series and per-listing results for a date range. See [Report endpoints](#report-endpoints). |
| `GET /broker/reports/leads?from=&to=&before=&limit=` | Keyset page of the user's leads, newest first. `limit` is 1–200 (default 50). Returns `{items}`. |
| `GET /broker/reports/export?kind=&from=&to=` | CSV download. `kind` is `leads` or `listings`. |
| `GET/POST /broker/listings`, `GET/PATCH /broker/listings/:id` | Own listing reads and draft saves. Every save sets unpublished/pending rights, uses approximate coordinates, and reconciles the gallery atomically. |
| `POST /broker/listings/:id/submit` | Requests listing review; grants no publication rights. |
| `GET /broker/leads`, `PATCH /broker/leads/:id` | Immutable inquiry-recipient assignment and own listing ownership bound lead reads/status updates. |
| `GET/PATCH /contact/preferences` | Verified recipient opts into email/LINE using `contact-relay-v1` consent. All-off withdrawal does not require renewed consent or a paid subscription. |
| `POST /contact/line-link` | Authenticated account consumes a LINE-issued link token and receives the official LINE account-link dialog URL. |
| `DELETE /contact/line-link` | Removes LINE identity, pending link nonces and queued LINE notifications, including after subscription expiry. |
| `GET /admin/brokers` | Staff-only `{items:[{...profile,subscription}]}`. `profile.accountKind` is `broker` or `owner`. |
| `PATCH /admin/brokers/:id` | Admin may suspend/reject an account. It cannot create payment evidence or bypass Stripe billing. |
| `GET/PUT /admin/properties/:id/contact` | Staff binds the listing to an existing verified recipient account. Accepts a user UUID; never arbitrary recipient email or LINE IDs. |

Inquiries require both `consent:true` and `consentToShare:true`, the existing Turnstile/rate protection, and an idempotency key. The saved inquiry returns `contactStatus:"queued"|"unavailable"` in addition to the existing staff-copy `emailStatus`. “Queued” means persisted for delivery; it does not promise a send before provider activation. The original staff-copy email outbox remains separate.

Draft input uses camel case (`priceThb`, `areaM2`, `sourceUrl`, `ownershipEvidence`, `privateLocation`, `images`). Billing, role, ownership assignment and publication fields are rejected. Authorized listing responses include private editing evidence and coordinates only in the broker API, which is `no-store`; none is added to public snapshots or public Storage metadata. Missing draft location is `null`; optional image credits/source URLs can be `null`. Dashboard reads fail explicitly above 1,000 own records; they never silently truncate. Report reads fail explicitly above 1,000 own listings. Admin list endpoints return at most 1,000 rows and set `truncated:true` when more exist, and the admin inquiries export fails with `422 export_limit_exceeded` above 5,000 rows instead of dropping rows. A larger broker workload needs pagination before activation for that workload.

## Payment state and race protection

Use migrations `202610040006_broker_subscription.sql`, `202610040007_contact_relay.sql`, `202610040008_contact_scheduler.sql`, then `202610040009_contact_preferences_upsert.sql` after the existing migrations through `202610040005_content_revision_safeupdate.sql`. Migration 09 corrects the actual PostgreSQL upsert/check ordering found during hosted verification; applied migrations 06–08 stay unchanged. Owner accounts (`202610270001_owner_accounts.sql`) and reports (`202610270002_broker_reports.sql`) apply after migration 09. They replace the 5-argument `broker_register` with a 6-argument version and redefine `broker_is_entitled`, `broker_start_checkout` and `broker_context`. Both were applied to the hosted database on 2026-10-27 and the `api` Edge Function was deployed as v11 with `verify_jwt=false`. The search_path follow-up `202610270003_owner_approval_search_path.sql` was applied to hosted on 2026-10-28; `proconfig` now shows `search_path=pg_catalog, private`.

Profiles, customer bindings, subscription facts, event receipts and listing ownership are in revoked, RLS-enabled `private` tables. Public application RPCs are executable only by `service_role`; the API derives the actor from `auth.getUser`, never from browser metadata. Staff and broker identities stay separate.

The webhook validates the exact raw UTF-8 Stripe body, HMAC signature, a five-minute timestamp window and configured test/live mode. It claims a per-customer database lease **before** fetching current subscription/invoice state. Busy or expired leases return a retryable error. Conditional state application and processed-event marking occur in one database transaction, so concurrent and duplicate callbacks cannot overwrite a newer fetch. Incoming event timestamps or Checkout return parameters do not grant access.

Entitlement requires the configured Price and mode, an active subscription, a paid positive invoice, an unexpired exclusive period end, no pause, no refund/dispute review block, and no staff suspension/rejection. Trials and zero-payment discounts do not qualify. Immediate cancellation, past-due, unpaid and paused states deny service; cancel-at-period-end preserves the paid period. Refund/dispute blocks remain until a documented operator investigation, rather than silently disappearing on another positive callback.

The Price validator accepts exactly `unit_amount=2500`, `currency=usd`, `recurring.interval=month`, interval count one and quantity one. Cached Checkout sessions are bound to Price/mode and checked again before reuse; existing outstanding subscriptions use the portal instead of creating another subscription. Config changes during session creation invalidate local completion.

The integration uses fixed-host REST requests and Web Crypto, with no new SDK dependency. Stripe API version `2026-08-26.dahlia` was verified against the official changelog on this date. Provider errors return fixed application codes and are not logged verbatim.

## Owner accounts

- `private.broker_profiles.account_kind` is `broker` or `owner`. It is set at first registration and re-registration does not change it.
- Owners use the same Stripe Price (US$25 monthly), the same entitlement rules and the same billing states as brokers. There is no free tier.
- `private.broker_config.owner_approval_required` defaults to `true`. `private.broker_approval_satisfied` returns true when the profile is `approved`, or when it is `pending` and neither the global `approval_required` nor the owner rule applies.
- A pending owner is not entitled even when paid. `broker_start_checkout` refuses Checkout until approval.
- `broker_context.entitlement.reason` is `approval_required` while an approval gate blocks access. Staff decide through the existing `admin_review_broker` path.
- Known limitation: the Stripe success and return URLs are still built for `/broker/dashboard/`, so owners land on the broker path. The data and access rules are the same. No backend change was made; move the return path before opening owner billing.

## Report endpoints

- The three `/broker/reports/*` routes require the same active entitlement as the dashboard.
- `from` and `to` are `YYYY-MM-DD` calendar dates, checked by round-trip. `to` must not precede `from`, and the window is at most 365 days. Otherwise the response is `422 report_range_invalid`. Day boundaries use Asia/Bangkok, matching `daily_property_stats`.
- Summary: `totals` (views, inquiries, contactClicks, leads, newLeads, contactedLeads, closedLeads, respondedLeads, medianResponseSeconds), `daily` (days with activity; the client fills the gaps) and `listings` (own listings with per-listing counts). Views, inquiries and contact clicks come from `daily_property_stats`.
- A lead is an inquiry routed to the user through `private.inquiry_recipients` and attached to a listing the user owns, counted by its created date in the range.
- `public.inquiries.first_response_at` is set once, by a `BEFORE UPDATE OF status` trigger, when status first leaves `new`. Leads created before the migration have no value and are excluded from the response-time median. They are not backfilled.
- Leads page: `before` is an ISO timestamp used as an exclusive keyset on `created_at`. `limit` is 1–200 (default 50). Invalid values return `invalid_cursor` or `invalid_limit`. Leads that share an identical `created_at` can be skipped at a page boundary. This is accepted at current volume.
- Export: `kind=leads` or `listings`. Any other value returns `invalid_export_kind`. A leads export over 10,000 rows returns `export_limit_exceeded` and never a partial file. The CSV is UTF-8 with a BOM and CRLF line endings. Formula-prefixed cells are neutralised by `safeCsvCell`. Responses are `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`. Filenames are `leads-<from>-<to>.csv` or `listings-<from>-<to>.csv`.

## Exact recipient delivery

A separate outbox is unique per inquiry, recipient user and channel. The server saves the recipient snapshot even if every channel is off, so delivery preferences do not hide a permitted broker lead. A reassigned listing does not expose historical customer details to the newly assigned broker. Legacy inquiries without an authorized recipient snapshot remain staff-only.

At enqueue time, destination and plain-text payload are frozen. Before each delivery attempt the server rechecks listing availability, exact current recipient assignment, recipient existence, channel consent/version, verified LINE link and unchanged destination. Email enqueue and dispatch also match the current confirmed `auth.users.email`; an Auth email change cannot retain the former delivery address. Revoked, deleted, expired or changed assignments are canceled. The visitor cannot supply destinations. Broker subscription state is not a prerequisite for a nonbroker owner to receive a permitted contact.

Email uses a fixed sender, exact verified recipient, visitor reply-to and `contact-<outbox UUID>` Resend idempotency key. LINE uses only the signed OA-bound user ID and the outbox UUID as `X-Line-Retry-Key`; a `409` counts as accepted only when LINE supplies `x-line-accepted-request-id`. Batches are at most five, provider/database requests are bounded, and retries have backoff. Notifications older than 23 hours or exhausted after ten attempts are canceled before the providers' 24-hour deduplication window. Failed/canceled rows remain available for private operator review.

There is an unavoidable in-flight boundary: a preference change after the last check may race a provider request already in progress. Do not promise exactly-once receipt, instantaneous withdrawal, provider availability or actual delivery from these checks.

## Official LINE linking

Configure a client-owned LINE Official Account Messaging API channel, channel access token, channel secret, public friend URL and webhook URL. LINE Notify is not used.

1. The user adds the OA and sends `link` in a direct chat. Group/room sources are ignored.
2. The verified webhook asks LINE for that user's link token and replies with a temporary `/broker/?lineLinkToken=...` URL.
3. After confirmed-email login, the account-link route stores a single-use, hashed 256-bit nonce, then redirects to LINE's official account-link dialog.
4. A signed `accountLink` callback must match that nonce, original OA user ID, authenticated account and ten-minute expiry. Linking alone leaves LINE notifications off until explicit channel consent.
5. `unfollow` disables LINE notification and cancels queued jobs. Explicit unlink also removes pending nonce bindings.

Account-link/unfollow replay recording and changes are atomic. Invitation-message receipts are recorded only after an accepted reply; an ordinary provider failure permits redelivery. A reply accepted by LINE followed by a lost response or database failure is still an uncertain receipt. The user can send a new `link` message to restart safely; no exactly-once invitation claim is made.

## Account setup and activation

No real values belong in source, public `NEXT_PUBLIC_*` variables, screenshots or this runbook. Put server secrets in the ignored, owner-only environment file and upload via the existing protected configuration process.

- Stripe: client-owned account, test secret, webhook secret and configured US$25 monthly Price. Leave `BROKER_BILLING_ENABLED=false` until account/Price/signature/invoice, failure, renewal, cancellation, refund, portal and cross-user tests pass with that account. Configure the private broker terms version only after approved subscription/cancellation/legal copy is available. The database and environment activation switches must both be true.
- Email: a verified client-owned sending domain, `RESEND_API_KEY` and `INQUIRY_EMAIL_FROM`.
- LINE: `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`, `LINE_OA_FRIEND_URL`, and `LINE_LINK_ENABLED` after account-link/unfollow tests.
- Contact worker: random 64-hex `CONTACT_WORKER_SECRET`, actual provider configuration, then `CONTACT_DELIVERY_ENABLED=true` and the private scheduler switch. Both must be enabled; neither is enabled by migration.
- App: `BROKER_APP_URL` is the exact approved HTTPS origin; return paths are fixed. Confirm Supabase allowed signup/redirect origins and actual email verification before exposing registration.

Deploy the API and `stripe-webhook`, `line-webhook`, `deliver-contact` functions with the checked custom signature/auth boundaries and `verify_jwt=false`. Webhook paths are `/functions/v1/stripe-webhook` and `/functions/v1/line-webhook`. Subscribe Stripe to Checkout, subscription, invoice paid/payment failed/action required, refund and dispute events listed in the source. Keep account-bound test and live webhook endpoints/secrets distinct.

Test-to-live setup must not reuse a Stripe test customer in live mode. Customer bindings record mode and reject mismatched reuse. While database billing is OFF, an actual staff admin may call the service-only `admin_reset_broker_test_billing(p_staff,p_actor,true)` to clear **only a verified test-mode customer binding**, retaining private event history and recording an audit entry. This cannot reset a live binding. Then configure the live US$25 Price, live mode and live key/webhook secret and verify that fresh live Checkout is possible before enabling billing. Changing a live Stripe account requires an explicit migration/reconciliation plan; never clear real subscriptions automatically.

The service-only `configure_contact_scheduler(p_project_url,p_secret,p_enabled)` prepares the matching project worker after existing content scheduler binding is established. `false` disables only `contact-delivery-schedule`; `true` stores secrets in private Vault and installs a once-per-minute queue check. Cron queues a target-bound HMAC with a 60-second acceptance window and private single-use nonce, not a permanent bearer. Managed pg_net PUBLIC SQL grants remain a known availability risk; its schema is not exposed through this REST API. Never inspect queue headers or Vault plaintext in shared logs.

Check real Cron HTTP outcomes, outbox due/failed/canceled counts and provider receipts. A successful Cron queue insertion is not proof of delivery. Retain approved backup/audit evidence; a restore including the new private tables still needs an actual recovery run. No new provider fees, cards, paid hosting upgrades or live billing are authorized by this preparation.

## Verification and remaining limits

Offline Deno tests cover signatures, exact fee, mode and ownership checks, current-state ordering, leases, duplicates, failures, expiry, cancellation, pause, refund/dispute blocks, forbidden broker fields, exact destination/payload, consent, opt-out, LINE linking and provider retry behavior. All provider traffic in these tests is mocked.

`tests/integration/broker-contact.sql` is a hosted-safe `BEGIN`/`ROLLBACK` assertion set covering private grants/RLS, own listings/leads, paid gating without signup approval, publication guards, immutable customer binding, event leases/deduplication, opt-out lead snapshots, nonce/replay checks, exact recipient outbox, Auth email changes, reassignment, withdrawal, refund blocking and suspension. `contact-preferences-upsert.sql` separately covers fresh email opt-in, rejection of unlinked LINE, verified existing LINE opt-in, LINE-only opt-in and withdrawal after email verification changes. Both create synthetic database fixtures only, never an Auth signup email or actual provider operation. Root records the actual migration, SQL, HTTP and frontend receipts in the shared verification/status documents after executing them.

Owner and report work (2026-10-27) adds `tests/integration/broker-owner.sql` and `tests/integration/broker-reports.sql`. Neither has been run: the local Docker engine returned HTTP 500, no `psql` is installed, and running them against hosted has not been approved. The two migrations are applied to hosted (see Account setup and the production status record). `tests/integration/broker-contact.sql` was updated to the 6-argument `broker_register` and is also unrun. Node-side checks cover the report helpers (`tests/integration/broker-report-api.test.ts`, `tests/unit/broker-report.test.ts`) and the owner and report frontend flows (`tests/frontend/owner.spec.ts`).

Real-account Stripe/LINE/email behavior, current backup recovery, approved legal/terms, production hosting entitlement and real rights-approved inventory remain deployment gates. Passing source/mock tests does not establish full production readiness.

Official references: [Stripe changelog](https://docs.stripe.com/changelog), [Checkout subscriptions](https://docs.stripe.com/payments/checkout/build-subscriptions), [Stripe webhook handling](https://docs.stripe.com/webhooks), [Customer Portal](https://docs.stripe.com/customer-management), [LINE account linking](https://developers.line.biz/en/docs/messaging-api/linking-accounts/), [LINE webhook signatures](https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/), [LINE retry keys](https://developers.line.biz/en/docs/messaging-api/retrying-api-request/).

## Actual hosted preparation — 2026-10-04

Root applied migrations 06–09 to `hpjmttoxomdhxxsourih`. The first broker/contact rollback run failed with SQLSTATE23514 on LINE preference upsert; forward09 was reviewed and applied, then the exact `broker-contact.sql` rollback suite passed. Follow-up reads found tracked synthetic users, broker profiles and contact jobs at zero. Private billing/delivery configuration remains OFF, monthly quote is2500USD minor units, terms version is unset, and normal signup approval is not required.

The CLI deployment of `api`, `stripe-webhook`, `line-webhook` and `deliver-contact` exited0 (archive `6dc74ff3ff7e6431`). The focused `contact-preferences-upsert.sql` assertion set also passed on the hosted database inside `BEGIN`/`ROLLBACK`, without provider calls. This confirms installed functions and SQL boundaries with disabled real-account operations; it does not verify Stripe, Resend, LINE, a live membership or public frontend hosting. Final HTTP, corrected-code browser and preview-build receipts are tracked in [broker-contact-review.md](reviews/broker-contact-review.md). The client-facing account/activation checklist is [broker-membership-and-contact.md](broker-membership-and-contact.md).

Actual metadata shows APIv7 and Stripe/LINE/contact functionsv1 ACTIVE, with23 hosted migrations. The read-only hosted HTTP suite passed18/18 at `2026-10-04T08:13:53.739Z`; evidence is [feature-hosted-http.json](evidence/feature-hosted-http.json). The quote is USD25/month with no approval, but broker registration, billing, delivery and LINE linking remain disabled. Private/forged-token/worker probes returned401; Stripe/LINE503 responses prove disabled configuration closes safely, not actual configured signature processing. Current provider tests and authenticated real-account activation remain outstanding.

Exact migration/bundle hashes, deployed versions, rollback SQL outcomes and fresh08:28:04UTC cleanup/config observations are preserved in [feature-hosted-database.json](evidence/feature-hosted-database.json). Tracked fixtures/jobs remain0 and no real inventory was published. Latest frontend type/lint/preview build,80units,11broker browser cases and the existing inquiry retry case passed; receipts are indexed in the feature review, with source/mock/provider limits retained.
