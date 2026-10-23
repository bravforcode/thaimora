# Cerebrum

> OpenWolf's learning memory. Updated automatically as the AI learns from interactions.
> Do not edit manually unless correcting an error.
> Last updated: 2026-10-23

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

## Decision Log

<!-- Significant technical decisions with rationale. Why X was chosen over Y. -->

- 2026-10-03: Next static export and isolated Supabase API. User subsequently selected the existing Vercel account/default domain; commercial eligibility remains unresolved on Hobby. Preview is noindex; production gates require actual data rights and acceptance. PhuketLens map/property direction uses Inter/Noto Sans Thai.
- 2026-10-03: User confirmed $0/month per Supabase project in bravforcode and explicitly authorized pausing graxia os and clothes-brand-production. New isolated projects are now active; old projects stay paused unless separately authorized and quota permits.
- 2026-10-04: User expanded scope to Stripe US$25/month broker membership. A verified current payment opens the broker dashboard without normal signup approval; listing publication review remains separate. Visitor-submitted contact routes only to that listing's consenting recipient via email/LINE. Billing, delivery and LINE linking stay OFF awaiting client accounts; no public frontend launch is established by the new backend deployment.
- 2026-10-23: Geoapify keeps apiKey as a query parameter because the official autocomplete docs define no header auth. The key never reaches responses or logs: fetchJson throws a generic code and serve() logs only the dispatch error name.
- 2026-10-23: Supabase advisors on thaimora-production (hpjmttoxomdhxxsourih), read-only, nothing applied. Security: anon and authenticated can execute 7 SECURITY DEFINER functions (is_admin, is_owner, content_is_public, property_is_public, property_image_is_public, public_content_meta, public_content_snapshot); pg_net is installed in public; 23 private-schema tables have RLS with no policy (deny by default, INFO). Performance: admin_memberships member_self re-evaluates auth per row; 17 unindexed foreign keys; 7 tables have multiple permissive SELECT policies. Each fix needs an approved migration.
- 2026-10-24: User chose to remove client-side live sign-in screens (admin staff login gate; broker sign-in/sign-up panel; broker forgot-password form now only when signed in) and keep server checks (broker-api returns 401 without Bearer; RLS unchanged). Live admin/broker pages can no longer obtain a token from the UI, so live data calls fail. The deployed preview is demo mode, so this change does not alter it.
