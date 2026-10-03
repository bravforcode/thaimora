# Thaimora content automation — 2026-10-04

This runbook covers Phuket editorial POIs, organizer events, public content revisions and ECB exchange rates. Property inventory, inquiry delivery and public frontend deployment have separate acceptance gates in [production-status.md](production-status.md). A successful metadata check does not supply property listings or event publication rights.

The user has no authorized organizer feed and explicitly accepted preparing the connection first. `organizer-json` remains disabled. The `osm-overpass` slot is also disabled and has no reviewed recurring adapter. Previously imported ODbL POIs remain available; their existing import time is not proof of current upstream data.

## Deployment and source boundaries

The dedicated backend is `hpjmttoxomdhxxsourih`; the public API base is `https://hpjmttoxomdhxxsourih.supabase.co/functions/v1/api`. The assigned Vercel domain is not proof that the public frontend is deployed.

| Registry source | Work and normal interval | Publication boundary |
| --- | --- | --- |
| `frankfurter` | Small ECB-only THB reference-rate JSON, daily | Indicative reference rates; preserve the ECB as-of date. No invented intraday source timestamp. |
| `tat-metadata` | Small TAT catalog metadata request, daily | Version monitoring only. `license_pending` remains appropriate without confirmed event rights. The large activity export is not downloaded by this worker. |
| `organizer-json` | Prepared complete-snapshot event adapter; OFF | Needs an authorized feed, private rights evidence, approved license/source URL, Phuket bbox and separately reviewed egress. |
| `osm-overpass` | Reserved POI slot; OFF | No automatic refresh is claimed. Enabling a row alone does not implement its adapter. |

The configured database job `content-sync-schedule` checks due work every five minutes. Source intervals are private per-source settings, constrained to 300–604800 seconds; current FX and catalog defaults are 86400 seconds. This is polling, with scheduler jitter, upstream delay and browser polling added to the interval. It is not a guaranteed real-time service.

**Scheduled ingestion is verified for the two enabled sources.** After the forward singleton safe-update correction, the natural 2026-10-03 18:50 UTC run (2026-10-04 01:50 ICT) returned HTTP 200 with two claims, two completions and zero failures on each backend. FX became `ready` with ECB as-of 2026-10-02; the TAT catalog check succeeded with resource version 2026-06-11T10:23:55.995195 while retaining `license_pending`. Thaimora still has 1868 published POIs and zero events. See [hosted receipt](evidence/content-automation-hosted.json) and [review](reviews/content-automation-review.md). These checks do not establish event-feed or recurring POI ingestion.

## Data path and bounds

`pg_cron` → private project-bound scheduler → `pg_net` signed POST → private Edge worker → service-only claim/finish/fail RPCs → licensed public views → `/v1/content` → visible browser subscribers.

Visitor requests read the database. They do not fetch TAT, Frankfurter, an organizer or public Overpass. One worker call leases at most two enabled due sources with `FOR UPDATE SKIP LOCKED`; leases last three minutes. Completed writes and source/run status updates use one database transaction. A stale or missing lease cannot finish a batch. A later claim records an abandoned run as failed before taking a fresh lease.

| Bound | Implemented behavior |
| --- | --- |
| Upstream | HTTPS approved endpoint, redirects rejected, 20-second fetch deadline, streamed JSON ceiling 1,000,000 bytes |
| Database RPC | Eight-second deadline |
| Organizer batch | Complete JSON snapshot, at most 500 events, unique IDs, EN/TH names, bbox validation and explicit timezone timestamps |
| Public content | Deterministic ID order, maximum 10000 records per collection; excess or incomplete reads fail instead of silently truncating |
| Worker failure | Retain last admitted data; sanitized error code; retries after 5, 10, 20, 40 then 60 minutes, with scheduler jitter |
| Evidence retention | Non-running source sync records older than 90 days and sanitized quarantine markers older than 30 days are pruned during that source's completion/failure |

Quarantine stores an invalid-batch marker, not upstream raw content. These source retention rules do not establish retention for cron history, backups or all admin audit records.

## Organizer feed contract

This is a contract example, not production data or an active feed:

```json
{
  "complete": true,
  "version": "publisher-revision-42",
  "updatedAt": "2026-10-04T09:00:00+07:00",
  "events": [
    {
      "id": "publisher_event_42",
      "status": "scheduled",
      "name": {"en": "Organizer supplied title", "th": "ชื่อจากผู้จัด"},
      "description": {"en": "Organizer supplied text", "th": "ข้อความจากผู้จัด"},
      "location": {"lat": 7.9, "lng": 98.3},
      "startsAt": "2026-10-10T10:00:00+07:00",
      "endsAt": "2026-10-10T12:00:00+07:00"
    },
    {"id": "publisher_event_41", "status": "cancelled"}
  ]
}
```

IDs use 1–100 ASCII letters, digits, underscores or hyphens and become `organizer-json:<id>` internally. Names in each language must be nonblank and at most 300 characters. Descriptions are bounded to 5000 characters per language. Each scheduled event needs finite coordinates inside the configured bbox, explicit `Z`/offset start/end and `endsAt > startsAt`. `updatedAt` is optional; absence remains null. `version` is required and at most 128 characters. Only `scheduled` or `cancelled` statuses are admitted; omitted status means scheduled. Invalid/duplicate IDs or an invalid snapshot reject the batch atomically.

`complete: true` means the publisher supplied the entire authorized catalog for this connection. Missing and explicitly cancelled source events are unpublished while retaining history. Do not connect a paginated or partial result as a complete snapshot: missing rows would be withdrawn. A previously withdrawn event can reappear automatically only while still approved, unprotected, not deleted and with unchanged source/license identity. Rejected rows, deletion tombstones and manual protection are preserved. A changed source URL/license identity demotes the affected row to pending/unpublished for review.

There is one prepared organizer connection per project. Multiple feeds, ICS calendars, webhooks, arbitrary website scraping and provider booking inventory are not implemented by this contract.

Before a later authorized activation, record the feed owner and commercial redistribution permission privately, verify the exact terms and location coverage, validate a bounded snapshot, and review endpoint trust/egress. `CONTENT_ORGANIZER_HOST` must match the HTTPS hostname and `CONTENT_ORGANIZER_EGRESS_VERIFIED=true` requires operational verification. DNS checks reject reserved/private addresses, credentials and custom ports, but do not pin fetch's subsequent DNS resolution. These checks alone do not prove protection against DNS rebinding. Keep the source disabled until that review and a real feed test are complete.

## Editorial control and expiry

Normal admin POI/event create or update requests force `admin_override=true` on the server. The editor's unchecked flag cannot bypass this protection. In the admin **Content updates** view, explicitly removing protection invokes `POST /v1/admin/{pois|events}/{encodedId}/automation` with `{"enabled":true}`. The service-only RPC verifies the actor's membership, locks the row and records the release audit in the same transaction.

Removing protection changes that flag only. It does not approve rights, publish a record, enable a source or erase a deletion tombstone. An enabled configured source may replace an admitted row on its next successful sync. With the current organizer and POI source slots disabled, releasing a row does not start ingestion.

The public event predicate checks publication/rights/demo eligibility and the exclusive end time on every database read. Expired rows remain in admin history. An open browser also removes an event at its end time and rechecks time when the tab resumes, so an upstream outage does not keep ended events visible. Missing/invalid end times are excluded. Database clocks govern API eligibility; browser clock accuracy still affects local display timing.

## Public refresh and timestamps

The tab loads full content once, then requests `/v1/content?scope=events` every 60 seconds while visible and online. Subscribers share one in-flight request and public in-memory content. Hidden/offline tabs stop polling and abort active work. A 12-second deadline and 2/4/8/15-minute client backoff retain the last available content and show a failure notice. A POI/home revision change triggers a full reload; unchanged event checks preserve the existing POI array.

Both scopes have separate weak ETags. Matching `If-None-Match` returns 304 without a body; full responses bind public data and revision metadata to one SQL snapshot. Cache-Control requires revalidation (`public, max-age=0, must-revalidate`). Expiry participates in event revisions even without a publisher update. Admin, inquiry and other private routes remain outside this public content cache.

| Timestamp | Meaning |
| --- | --- |
| Browser `checkedAt` | Last successful API validation, including 304; displayed as **Content last checked** |
| Registry `checked_at` | Last recorded source attempt |
| `last_success_at` / record `fetched_at` | Successful ingestion/check time, not publisher edit time |
| `source_updated_at` / ECB `as_of` | Publisher supplied timestamp/reference date; null when the source supplies none |

A healthy API and 304 do not clear an upstream source warning. Disabled/never-successful/error sources remain distinguishable. The API copies only public status/version/timestamp facts; it omits endpoints, leases, credentials and private rights evidence.

## Private invocation and monitoring

The scheduler secret stays in protected local/Edge configuration and Vault. Queued requests contain an HMAC SHA-256 signature over the protocol marker, Unix timestamp, nonce and exact project worker URL, not the permanent bearer. The worker accepts only the 60-second past / 10-second future window and atomically consumes the nonce through a service-only RPC; used nonces are retained beyond that window for two minutes. Cross-project signatures and replays fail.

Managed `pg_net` queue/response tables are owned by `supabase_admin`; tenant revocation did not remove effective PUBLIC SQL privileges. They are outside the exposed REST schemas, but that does not prove inaccessible SQL queues. Short-lived signatures avoid disclosing a permanent worker credential there. Queue tampering/availability by a principal with SQL access remains a documented limitation. Do not claim that the tenant revoked those managed grants or print queue headers, Vault secrets, protected env files or raw worker errors.

After deployment, configuration can be performed with the existing protected-env helper:

```powershell
./scripts/configure-content-scheduler.ps1 -ProjectRoot 'C:/Users/menum/Projects/thaimora' -ProjectRef hpjmttoxomdhxxsourih -Site thaimora
```

This mutates only this project's named scheduler and emits a safe configuration receipt. Configuration is not an execution acceptance test. For an owner-triggered due-work retry, from this project directory use:

```powershell
node --env-file=.env.production.local --import tsx scripts/sync-content.ts all
```

The CLI's legacy `fx`/`tat` arguments do not filter registry leases. Use `all`: one call processes at most two due sources, not every source unconditionally. It does not bypass disabled sources, rights checks, leases or future `next_due_at`. The private direct CLI bearer is not queued through pg_net.

The GitHub workflow is a manual fallback only, with no schedule. It retains `AUTOMATION_ENABLED == 'true'` and the shared free Actions reserve check; protected worker credentials are exposed only to the invocation step, without a database service-role key. No new remote, push, hosted workflow run or gate enabling is implied by the file change.

Owner monitoring should inspect safe fields only:

```sql
select jobid, jobname, schedule, active
from cron.job where jobname = 'content-sync-schedule';
select id, kind, enabled, status, checked_at, last_success_at,
       source_updated_at, next_due_at, failures, error_code
from private.content_sources order by id;
select source, status, started_at, finished_at, rows_read, rows_written, error_count
from public.sync_runs order by started_at desc limit 20;
```

Confirm an actual natural cron run, corresponding worker HTTP result, source attempt/success and expected data counts. Cron success alone confirms SQL/queue submission. HTTP 200 with `failed > 0` still requires investigation. A not-due/no-op response is not new upstream data. On failure, keep approved data, inspect sanitized stage/code and the source's next due time; fix configuration/schema/egress before forcing retries. Pause only the owned named job using the commented owner-scoped command in `supabase/operations/content-scheduler.sql`; preserve unrelated jobs and data.

Supabase Free quotas are finite. Monitor database/storage/egress/Edge usage and retry volume; no paid fallback or automatic upgrade is authorized. Recovery must include private registry, tombstones, rights evidence and required secret reconfiguration; review [production-recovery.md](production-recovery.md). Earlier synthetic recovery does not verify restoration of the new automation migrations. Full launch still requires the separate hosting, legal/admin, listing-rights and acceptance/recovery evidence.
