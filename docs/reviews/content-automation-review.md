# Thaimora automation review — 2026-10-04

Scope: bounded private source worker, reconciled event snapshots, signed scheduling, public content HTTP revisions and frontend freshness controls. This is a focused implementation/evidence record, not certification that the full website is production ready. Organizer and recurring OSM sources remain OFF as accepted by the user.

## Corrected findings

| Finding | Correction and verification boundary |
| --- | --- |
| Cancelled/missing source events could survive a snapshot | Only complete snapshots reconcile absence; cancelled entries are excluded and their unprotected prior rows unpublished. History remains. |
| Withdrawn approved events could fail to return | Reappearance restores eligible approved future events; rejected/manual/deleted rows remain protected. Source/license identity changes require review. |
| NULL/stale/duplicate leases could admit updates | Explicit nonnull current lease/run checks and locked claims; hosted rollback-only SQL covers stale/NULL and bounded claim cases. |
| Manual saves could opt out of replacement protection | API forces manual override; separate membership-checked release RPC changes only that flag and writes audit atomically. |
| Colon source IDs and long audit IDs differed across layers | Decode individual path segments once; reject malformed/control input; support 115-character source IDs through the 200-character route/audit boundary. Focused path/audit tests cover exact IDs. |
| Successful API refresh could conceal upstream failure | Public source health stays distinct from browser check time; 304 is a validation, not a publisher update. |
| Fetching all POIs on each visible refresh wasted work | Event-only checks, separate validators and full reload only when POI/home revisions change; directory rendering limited to 48 cards per page. |
| Separate metadata/data reads could attach mixed revisions | Public full snapshot RPC uses one SQL snapshot; counts above the 10000 collection ceiling fail closed. |
| Permanent credentials could enter a managed SQL-readable queue | Scheduler now queues project/time/nonce-bound HMAC signatures; single-use nonce RPC rejects replay. Managed queue availability remains a limitation. |
| Organizer DNS approval could be overclaimed | Prepared adapter stays OFF; hostname/rights and a separate verified-egress gate are required. DNS checks are not DNS pinning. |

## Evidence and observed failures

The root applied automation, reconciliation, signing and public-snapshot migrations to both hosted projects. Initial reconciliation SQL failed with `42702` because a JSON row alias conflicted with a PL/pgSQL variable; that transaction rolled back. Migration `202610040002_content_reconciliation.sql` corrected the alias. Extended hosted rollback-only SQL then covered expiry through public predicates/views and anonymous base RLS, private function privileges, claims, protection, cancellation/reappearance, rejection/tombstones, backoff, release audit and nonce replay/expiry. These fixtures were rolled back; they are not live organizer-feed evidence.

Anonymous public-snapshot rollback assertions passed. A TaoTide assertion initially compared SQL NULL with JSON null; its corrected assertion tests the actual documented null representation. This was a test-harness correction, not proof that a publisher feed ran.

The first natural cron worker reached nonce consumption but source claims failed through REST with PostgreSQL `21000`, `UPDATE requires a WHERE clause`. The revision trigger updated its singleton table without an explicit WHERE; PostgREST's safe-update session constraint rejected it. Direct SQL rollback tests did not use that REST session constraint and missed the failure. Forward migration `202610040005_content_revision_safeupdate.sql` adds the singleton predicate. Both projects were migrated and the later natural run and actual admin writes passed; preserve the earlier failed receipts. Thaimora has 19 hosted migrations after this forward correction.

| Recorded check | Result and limit |
| --- | --- |
| Worker/signature/DNS tests | 18 offline Deno tests per project passed; mocked upstream and DNS paths |
| Public-content HTTP tests | 10 offline Deno tests per project passed, including atomic snapshot delivery; archive `34e5a4b943ffb402` |
| Frontend | 58 unit cases and four Chromium fixture flows passed; archive `3c6a5e97e988bfa9`; final helper lint/type/focused checks `97bbd951bd68834a`; final preview build `82fabff6c717ec33`, 76 static pages; frontend commit `2e68a4ca0518b5f2190848483fc4c63d17e6305c` |
| Temporary-admin HTTP | Seven actual cases passed with a 115-character colon ID (`d0a7c9`); exact Auth/membership/event/tombstone cleanup confirmed, private audit retained; nine offline lifecycle/cleanup regressions also passed |
| Public HTTP/CORS | Five actual cases passed (`e696d6`): complete POI counts, visible validators, empty 304, conditional preflight and denied unapproved origins; [safe evidence](../evidence/content-public-http.json) |
| Private worker HTTP | Five actual authorization cases passed (`3586ba`): anonymous/bad/expired signatures denied, signed no-due work accepted, replay denied; [safe evidence](../evidence/content-worker-http.json) |
| Scheduler setup | Safe configuration receipt in `docs/evidence/content-scheduler-configured.json`; active five-minute job is configuration evidence |
| Natural cron execution | Initial 18:30 UTC worker receipts were 503. After the forward fix, 18:50 UTC HTTP 200 receipt ID 5 reported `claimed:2, completed:2, failed:0`; registry confirmed daily FX `ready` and successful metadata-only TAT `license_pending`; [hosted evidence](../evidence/content-automation-hosted.json) |

Source review and fixture browser flows do not establish real intended-admin UAT, production frontend deployment, upstream availability, load capacity or latest hosted restore. Read actual final-build/HTTP evidence before making a stronger claim.

## Measurement limits

The root deployed both v2 snapshot APIs (`f4501be94cc01ae5`) and recorded a later probe after natural ingestion. The earlier full-response regression remains in the evidence; TaoTide's regression motivated the atomic snapshot change.

| Probe | Full p50, five samples | Conditional event p50, five samples | Event-only decoded response, one sample |
| --- | --- | --- | --- |
| [Baseline](content-api-baseline.json) | 650.3 ms | Not measured | Not measured |
| [First pass](content-api-measured.json) | 767.7 ms | 309.5 ms; body 0 bytes | 702 bytes |
| [Optimized snapshot](content-api-optimized.json) | 481.6 ms | 266.5 ms; body 0 bytes | 839 bytes |

Those are small uncontrolled samples, with p95 equal to the largest of five observations. The observed optimized median is lower in this probe; it does not establish a repeatable production speed guarantee. Decoded body sizes are not wire transfer measurements. These probes do not prove mobile LCP/INP/CLS, cold-start performance, global speed or a concurrent-load SLA. No paid stress infrastructure or aggressive public-source polling is authorized.

## Remaining release boundaries

No authorized organizer URL/rights evidence exists; no real event feed is connected. TAT checks metadata only and retains `license_pending`. Recurring OSM refresh is not implemented/enabled. Existing published POIs and ECB quotes remain distinct from future fresh-source acceptance.

Managed pg_net PUBLIC SQL privileges could not be revoked by the tenant owner; HMAC/short-lived replay protection avoids queued permanent-secret disclosure but does not remove SQL queue-tampering/availability exposure. Private schemas and Vault remain denied to client roles; exposed REST schema configuration is a separate boundary.

Hosting commercial eligibility, legal/admin identity, the agreed real property inventory, provider/email configuration as applicable, intended-user UAT and current hosted recovery remain outside this completed source review. Full production gates stay closed until their real evidence is accepted. See [production-status.md](../production-status.md) and [runbook](../content-automation.md).
