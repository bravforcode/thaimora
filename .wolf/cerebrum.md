# Cerebrum

> OpenWolf's learning memory. Updated automatically as the AI learns from interactions.
> Do not edit manually unless correcting an error.
> Last updated: 2026-10-28

## User Preferences

<!-- How the user likes things done. Code style, tools, patterns, communication. -->

- 2026-10-03: Thai concise progress updates; detailed separate implementation plan files. Scope and visual references already approved; do not reopen the completed interview.
- Free services, no credit card, no automatic billing/upgrades; client-owned domains are the approved cost exception.

## Key Learnings

<!-- Project-specific conventions discovered during development. -->

- Public browsing is anonymous. "Authorized listings" means publication rights, not authenticated visitors.
- Static snapshots omit exact property coordinates. Public map/search/distance must use safe coordinates consistently to prevent spatial-query inference.
- Destination imagery in preview is illustrative; it does not satisfy listing-photo or 500-real-listing acceptance.

## Do-Not-Repeat

<!-- Mistakes made and corrected. Each entry prevents the same mistake recurring. -->
<!-- Format: [YYYY-MM-DD] Description of what went wrong and what to do instead. -->

- [2026-10-23] npm 11.6.0 regenerating package-lock.json drops the @rolldown/binding-* optional entries, so vitest fails with "Cannot find native binding". Regenerate lock changes with npx --yes npm@latest install --ignore-scripts, then rm -rf node_modules and npm ci.
- [2026-10-27] Summaries recorded next 16.4.2 and five high dev findings; installed was next 16.3.8 with critical advisories. Check installed versions (package-lock.json, `npm ls`) before claiming a version.
- [2026-10-27] Do not junction `node_modules` from another worktree: `next build` fails with "Could not find the Next.js package". Run `npm ci` in the worktree.
- [2026-10-27] `npm audit fix` (even with `--omit=dev`), `npm update`, and `npm install --package-lock-only` all dropped 26 optional native entries here (`@rolldown/binding-*`, `vite/node_modules/lightningcss-*`). `npm ci` then skips them and Vitest fails with "Cannot find native binding". Lock-only writes do not restore them. Restore from HEAD (unchanged versions) and take rolldown binding integrity from `npm view <pkg>@<ver> dist`; then `npm ci` and confirm `node_modules/@rolldown/binding-win32-x64-msvc` exists.
- [2026-10-27] Never run `npm audit fix --force` here: it installs breaking wrangler@4.153.0. Accept dev-only highs with a recorded reason instead.
- [2026-10-27] Never use bare `git stash` in this repo: the stack is shared across worktrees and sessions.
- [2026-10-28] New SQL functions need `set search_path=...` at creation. Supabase advisor `function_search_path_mutable` fired on `private.broker_approval_satisfied`, which was created without it. Fix with a forward migration (`202610270003`).
- [2026-10-28] Never edit a migration already applied to hosted. Add a new forward migration file; the edited file would drift from what hosted actually runs.

## Decision Log

<!-- Significant technical decisions with rationale. Why X was chosen over Y. -->

- 2026-10-03: Next static export and isolated Supabase API. User subsequently selected the existing Vercel account/default domain; commercial eligibility remains unresolved on Hobby. Preview is noindex; production gates require actual data rights and acceptance. PhuketLens map/property direction uses Inter/Noto Sans Thai.
- 2026-10-03: User confirmed $0/month per Supabase project in bravforcode and explicitly authorized pausing graxia os and clothes-brand-production. New isolated projects are now active; old projects stay paused unless separately authorized and quota permits.
- 2026-10-04: User expanded scope to Stripe US$25/month broker membership. A verified current payment opens the broker dashboard without normal signup approval; listing publication review remains separate. Visitor-submitted contact routes only to that listing's consenting recipient via email/LINE. Billing, delivery and LINE linking stay OFF awaiting client accounts; no public frontend launch is established by the new backend deployment.
- 2026-10-23: Geoapify keeps apiKey as a query parameter because the official autocomplete docs define no header auth. The key never reaches responses or logs: fetchJson throws a generic code and serve() logs only the dispatch error name.
- 2026-10-23: Supabase advisors on thaimora-production (hpjmttoxomdhxxsourih), read-only, nothing applied. Security: anon and authenticated can execute 7 SECURITY DEFINER functions (is_admin, is_owner, content_is_public, property_is_public, property_image_is_public, public_content_meta, public_content_snapshot); pg_net is installed in public; 23 private-schema tables have RLS with no policy (deny by default, INFO). Performance: admin_memberships member_self re-evaluates auth per row; 17 unindexed foreign keys; 7 tables have multiple permissive SELECT policies. Each fix needs an approved migration.
- 2026-10-24: User chose to remove client-side live sign-in screens (admin staff login gate; broker sign-in/sign-up panel; broker forgot-password form now only when signed in) and keep server checks (broker-api returns 401 without Bearer; RLS unchanged). Live admin/broker pages can no longer obtain a token from the UI, so live data calls fail. The deployed preview is demo mode, so this change does not alter it.
- 2026-10-27: Owner accounts reuse the broker tables and entitlement: `broker_profiles.account_kind` (`broker`|`owner`), same Stripe price (US$25/month). Owner approval defaults on (`broker_config.owner_approval_required=true`); pending owners cannot start Checkout. Reason: listing rights for owners must be checked before publication.
- 2026-10-27: Reports go through security-definer RPCs that take `p_actor` from the validated JWT, not direct table grants. Day boundaries are Asia/Bangkok (matches `daily_property_stats`). Range max 365 days. CSV leads capped at 10,000 with an error, never silent truncation. `inquiries.first_response_at` is set by a BEFORE UPDATE trigger and is not backfilled.
- 2026-10-27: Audit fixes limited to non-breaking `npm audit fix --omit=dev` (next 16.4.3, zod 4.6.7). Dev-only highs (sharp/undici via wrangler/miniflare) accepted until a breaking wrangler upgrade is approved.
- 2026-10-28: Owner/report migrations applied to hosted and `api` v11 deployed, each in its own approved step, then smoke-checked. Advisor-driven follow-ups are forward migrations and wait for their own approval.
