# Verification record — Thaimora

Verified on **2026-10-03**. This project has a working local preview, static export, admin interface, database migrations, Edge APIs and operating scripts. No production site was deployed. Preview listings are synthetic and destination photos are illustrative; they do not fulfill the 500-real-listing launch requirement.

## Executed checks

| Check | Observed result | Preserved archive IDs |
| --- | --- | --- |
| TypeScript, ESLint, unit tests, static export | Passed; 38 unit tests; 76 routes and 75 HTML locale checks | `ffc0343d4cc98171` |
| Final TypeScript after export-scanner fix | Passed | `421c0967bd8e35d2` |
| Browser checks | 16 preview + 7 mocked-live contract + 8 material behavior tests passed across their respective runs | `ffc0343d4cc98171`, `800d3ec15740719d` |
| Backend helper/integration tests | 17 passed; the two export-scanner regressions were rerun and passed after the last JSON/JWT correction | `7b008be1edc04591`, `3e092b2cbeadf9ab` |
| Deno entrypoints | API final check passed; email worker check passed during the earlier backend run | `29697133c833d66e`, `7b008be1edc04591`, [earlier backend log](evidence/backend-verification.txt) |
| PostgreSQL/PostGIS | All migrations through 011, database checks, 500-record pagination and review regressions passed on disposable local Postgres | `29697133c833d66e` |
| Encrypted dump and actual restore | 81,689 encrypted bytes; restored permissions/private rows/inquiry-outbox idempotency checked on synthetic data | [earlier backend log](evidence/backend-verification.txt) |
| Final visual captures | Seven valid captures, no reported overflow/browser errors; correct EN/TH locale | `2313e1cc5c89969b` |
| Source reviews | Specification PASS; bounded code review APPROVED; four visual fixes resolved | [source review](reviews/source-review-final.md), [visual review](reviews/finish-review.md) |

These are local checks. The mocked-live browser tests exercise API contracts with test transports, not hosted Auth, real email delivery or actual map/geocoding credentials. PostgreSQL tests bootstrap synthetic auth roles; they are not a successful full Supabase stack deployment. The encrypted restore drill preceded final review migrations; the latest migrations were tested separately. A fresh hosted restore drill is required before launch.

The 500 pagination records and 2,000 clustering records are synthetic test fixtures. Actual OSM extraction produced 1,868 licensed Phuket records; a balanced subset is used for the preview. No physical POI survey or hosted source import is claimed. Commons photo attribution and OSM source evidence are in [open-data](open-data.md) and [asset provenance](assets-provenance.json).

## Reproduce local checks

Use Node 24+, Docker and the existing CLI tooling. From this repository:

```powershell
npm ci
npm run typecheck
npm run lint
npm run test:unit
npm run test:backend
npx deno check --config supabase/functions/deno.json supabase/functions/api/index.ts supabase/functions/deliver-email/index.ts
powershell -NoProfile -File scripts/test-database.ps1
npm run build
npm run test:e2e
npm run test:e2e:live
npm run test:e2e:material
```

The PowerShell SQL harness waits for TCP readiness and removes only its own labelled disposable container. The Bash/GitHub workflow is provided but was not executed in GitHub. Browser checks use cached Playwright Chromium; install the required test browser on a new machine. Preview serves at [localhost:4100](http://127.0.0.1:4100/); restart instructions are in [README](../README.md).

Full raw tool output is preserved locally by lean-ctx. An archive `abcdefgh...` resolves to `C:/Users/menum/.local/share/lean-ctx/archives/ab/abcdefgh....txt`. An archive can include a corrected earlier failure as well as later checks; the ledger above identifies successful final runs.

## Observed failures and remaining dependency finding

- Full local Supabase startup timed out on image downloads; the retry raced startup. Disposable PostgreSQL was used for SQL evidence.
- Initial test-container readiness used a temporary Unix socket and raced shutdown. TCP readiness fixed it: initial archives `6e094226b58f5c6c` and `02d338388133156c`; final SQL run passed.
- New publication protections correctly rejected old demo-labelled SQL fixtures. They were changed to explicitly synthetic non-demo fixture rows inside rollback-only tests; archive `1ad0f2058cafcd40`.
- An optional Zod transform inferred required frontend fields; corrected with the outer optional schema, final type/build passed. Failure archive `5700ed2c2aa758b4`.
- A mocked-live selector was initially ambiguous; the corrected seven-test run passed in `800d3ec15740719d`.
- Full dependency audit: **five high development-package findings** from the braces stack-exhaustion chain, advisory GHSA-vfj7-8cjw-p6xm; archive `dd8beafb20ff791b`. Production-only audit reported zero. npm proposed an eslint-config-next major downgrade; it was not applied. Build-tool dependency remediation remains open.
- Invalid screenshot attempts were repaired before the final valid round, including archive `6cf45f781d5c2f49`. No blank/wrong-page captures count toward the visual verdict.

## Repository handover checks

Staged-file checks passed: generated build/dependency folders, real env files, private catalog output and backup artifacts were excluded. The credential-pattern scan returned zero matches for private-key, AGE secret-key and common live-key patterns; this is a bounded pattern scan, not a security certification. Local Markdown document links resolved. `git diff --cached --check` passed after removing Markdown hard-break trailing spaces and one workflow command trailing space. Repository text is normalized to LF by `.gitattributes`.

Both static preview URLs returned HTTP 200 during the final handover check. OpenWolf final anatomy scans completed (archive `b0436d0fdd637cae`); file counts are filesystem indexes, not provider usage. No Git remote or push was configured.

## Required before live acceptance

| Gate | Current state / required evidence |
| --- | --- |
| Client inventory | 500 real Phuket properties with ownership, source and gallery rights evidence; bilingual content; approved coordinates and expiry |
| Hosted accounts | Client-owned Supabase/Cloudflare/domain; actual free-tier and shared GitHub/account budgets verified; no card or automatic upgrade |
| API and admin | Hosted JWT/roles/RLS, geocoding/map keys, public-safe snapshot, source sync, atomic admin save/import, audit and stats tested end to end |
| Enquiry | Turnstile hostname/action, database save, email outbox retry and actual Resend delivery; approved LINE/WhatsApp contacts |
| Privacy and legal | Client-approved EN/TH legal content; private point/evidence cannot be read publicly; exact-public consent revocation; EXIF-stripped image upload |
| Recovery | Final hosted dump/restore including Auth ownership plus separate Storage image recovery; private daily encrypted workflow and retention verified |
| Devices/accessibility | Actual latest two browser versions and physical iOS/Android; 360/1024px core flows, keyboard/screen reader and WCAG 2.1 AA acceptance |
| Performance | Measure mobile 4G LCP target <=2.5s; current result **unmeasured** |
| Production export | Real sanitized snapshot, legal JSON, reviewed launch evidence and `npm run build:production` pass; approved DNS/domain and UAT |

Do not turn a local preview/test pass into a live acceptance claim. Scope and the complete UAT checklist remain in the [implementation plan](superpowers/plans/2026-10-03-thaimora-implementation-plan.md).
