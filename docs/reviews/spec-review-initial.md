# Independent spec review — initial findings
Reviewed 2026-10-03. Disposition: **changes requested** before fixes.
Reviewer: fresh read-only `/root/spec_review`. Findings are retained as evidence;
they are not the final condition of the subsequently corrected source.

| ID | Scope | Defect found | Required correction |
| --- | --- | --- | --- |
| S01 | Thaimora P12 | Turnstile widget omitted action=inquiry; response emailStatus differed from UI deliveryStatus | Align widget action and response; verify success/retry |
| S02 | P14/F19/publication | Approved flags alone admitted missing license/provenance or demo content | Fail closed in database/public read/API/export |
| S03 | Thaimora P18 | Camel-case import/export differed from server snake-case contract; row errors ignored | Canonical adapter, rights fields, duplicates policy and honest row results |
| S04 | Thaimora P17 | Server-generated ID ignored after POST; gallery only upserted | Persist canonical response; reconcile order/deletions/rights |
| S05 | Thaimora P19/P23 | GET tracked unconsented views; UTC statistics; {items} cast as numeric record | Opt-in event path, Bangkok date range/export, correct inquiry/stat DTO |
| S06 | Thaimora P07 | Autocomplete {name,location} used as {label,lat,lng} | Normalize before render/selection; keyboard/error states |
| S07 | TaoTide F04/F05 | Nightly comparison omitted Booking totals, currency and tax comparability | One comparable selected-stay amount used consistently |
| S08 | TaoTide F11 | UI sent car while API accepted drive | Align wire mode and unavailable-provider behavior |
| S09 | TaoTide F20 | Homepage settings did not reach public homepage or snapshot | Allowlisted settings DTO/export and actual consumption |
| S10 | P17/F19/F20 | No server audit schema/triggers | Sanitized actor/change records and private RLS |
| S11 | Thaimora P08 | Draw lacked undo/keyboard/max/self-intersection; boundary excluded locally | Accessible drawing, validity and boundary-inclusive consistency |
| S12 | TaoTide F23 | No sitemap or factual hotel structured data | Real-domain bilingual sitemap; exclude fixtures and unauthorized offers |

Additional approved gaps found: Thaimora amenity/zone controls and filter URL
persistence, persisted compare IDs, admin draggable pin and expiry warnings;
TaoTide clustered pins and keyboard focus synchronization, detail events during
selected stay, Bangkok/date-range click reporting; public source timestamps.

Source evidence was supplied in the reviewer return with exact paths and lines.
Examples: Thaimora inquiry.tsx:31, admin.tsx:175/295/370,
api/index.ts:68/76/88, initial.sql:191; Tao hotel-detail.tsx:12,
explore.tsx:18, home.tsx:8, initial.sql:129.
Line numbers refer to the pre-fix tree and may move.

Reviewer independently ran: Thaimora 19 unit / 13 integration and TaoTide
19 unit / 18 integration tests, all passing. The passing suites did not cover
the mismatched interfaces above. Both runtime-only audits had zero findings;
both full audits had five high development-tool findings.

External gates were kept separate: hosted Auth/Storage/email/Turnstile/routing,
live Booking.com and Agoda entitlements and attribution, real licensed property
and hotel data, legal copy, domains, free-tier accounts and actual UAT.
No external launch gate was declared verified by this review.
