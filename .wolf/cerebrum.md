# Cerebrum

> OpenWolf's learning memory. Updated automatically as the AI learns from interactions.
> Do not edit manually unless correcting an error.
> Last updated: —

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

## Decision Log

<!-- Significant technical decisions with rationale. Why X was chosen over Y. -->

- 2026-10-03: Separate Next static-export Cloudflare Pages and Supabase API; preview is noindex, live is gated by actual entitlements and data rights. User selected the map/property composition from PhuketLens with Inter/Noto Sans Thai.
