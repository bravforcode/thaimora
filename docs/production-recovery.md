# Production recovery

This runbook covers encrypted logical database backups and an owned disposable restore check. Production recovery still requires hosted Auth, Storage, provider and email verification.

## Verified local evidence — 2026-10-03

These restore runs predate the new internal-trigger ACL and managed-default-grant migrations. They establish the earlier migration snapshot only. The latest full local SQL/restore runs were not completed because Docker became unresponsive; see production-status.md. Actual hosted PostgreSQL17 rollback-only SQL checks passed separately and do not replace a recovery drill.

The actual image pull resolved to `postgis/postgis@sha256:01a6a70e41e6c4467c8f55f6063555ed72db2d6662cd0d571040d42eadaeb6f6`. Both complete migration sets were dumped, encrypted with age, decrypted and restored on PostgreSQL 17, then the existing SQL/RLS assertions ran against the restored database. These were synthetic local databases, not client inventory or a hosted Supabase recovery.

- Thaimora: 127026 encrypted bytes; archive `085313977c3db548`. Private legacy image proof and its restored anonymous/service grants also passed.
- Tao Tide: 108684 encrypted bytes; archive `6e640c280b5bf6c7`. Informational area seed included.
- Same backup scripts are used by both sites. Actual PG17 client rejected a PG15 source before dump/restore; source schema inventory remained unchanged: `bddbeb50ac8235a1`.
- Earlier PG15 evidence in `docs/evidence/backend-verification.txt` remains historical.

Run `bash scripts/test-backup.sh` for the isolated synthetic drill, or add `--source-pg15` for the version rejection test. The test creates a labelled network/source with no published ports and removes only its owned containers/network. Its ephemeral age identity is deleted; its encrypted fixture output is not a production backup.

## Daily operations

Required ignored operator or private CI inputs:

- `DATABASE_URL`: verified selected source, reachable from Docker with TLS; use a direct connection or supported session pooler, not transaction pooling.
- `AGE_RECIPIENT`: public recipient matching the independent recovery identity.
- `AGE_IDENTITY_FILE`: private identity file, supplied only during encryption/restore verification. Keep an independent recovery identity outside the repository and CI account.
- `PG_BACKUP_IMAGE`: reviewed immutable PG17/PostGIS digest. The workflow requires the exact tag-plus-sha256 format; audit a replacement image before changing it.
- GitHub budget inputs must cover the actual shared account repositories. Opt-in automation remains disabled until ownership, usage reserve, recovery custody and hosted source compatibility are verified.

`bash scripts/backup-db.sh` verifies client/source/target major17 and actual source TLS, rejects any external `RESTORE_DATABASE_URL`, creates its own random owner-labelled restore container, waits for TCP and checks ownership before reset/cleanup. It publishes no target ports. A synthetic network override requires the fixture URI and matching source/network labels; it cannot serve as an ordinary production connection override.

The encrypted archive includes `public`, `auth`, `extensions` and `private` when present. It preserves table data, grants and RLS, including private image evidence. Built-in PostGIS spatial reference data are excluded. Each accepted artifact is bounded to30MiB, with7-day GitHub retention. Incomplete encrypted files and owned target volumes are cleaned up. Success means PostgreSQL accepted the selected archive restore; it does not establish all application semantics for real data.

## Recovery limits

The drill creates NOLOGIN role names from the current source to resolve ACLs. Global-role passwords, login flags, memberships, platform ownership and connection settings are not archived. Maintain a separate protected role/configuration inventory for recovery when the original source is unavailable.

Database metadata does not restore image object bytes. The scoped dump excludes Storage objects, Vault secrets and Cron jobs. Recreate supported extensions, Storage policies/object backup, Vault/Edge secrets, scheduler configuration and GitHub/Vercel settings. Custom SRIDs and extensions need their own restore verification. Logical auth rows do not reproduce hosted Auth signing keys, SMTP/OAuth settings or existing sessions.

## Hosted recovery

1. Preserve the original database and keep the affected service offline/read-only. Select a reviewed new same-major Supabase recovery project; verify ownership, plan/quota and cost first.
2. Retrieve the encrypted artifact and independently held identity. Check timestamp, recipient, size and catalogue. Review dump SQL before restoring a source you do not trust.
3. Configure matching platform roles/extensions and restore through the provider's documented recovery process. Never point the disposable reset script at a hosted database.
4. Restore Storage object bytes separately; reapply bucket/policy migrations, recreate Vault/Edge secrets and deliberately reconfigure scheduler destination for the new project.
5. Redeploy APIs/frontends with the selected safe public URL/key and server-only credentials. Verify CORS, staff sign-in, RLS/private fields, uploads/public metadata, inquiry idempotency/retry, provider failures and current licensed content.
6. Record hosted Auth, Storage, email, sync and browser UAT, then cut over hosting. Run an actual hosted-to-disposable encrypted recovery and monitor the first scheduled backups.

No hosted recovery or scheduled workflow execution has been recorded.

References: [PostGIS image](https://github.com/postgis/docker-postgis), [PostgreSQL pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html), [Supabase backups](https://supabase.com/docs/guides/platform/backups).

## Durable inquiry email retry

`supabase/operations/email-scheduler.sql` installs private owner-only routines using Supabase Cron, pg_net and Vault. It does not register a job until a verified project configuration is supplied.

1. Deploy `deliver-email` with its own Bearer worker-secret authentication (`verify_jwt=false`). Configure verified sender/recipient, Resend credentials and a new32-byte worker secret through private secret tooling.
2. In protected Supabase Vault create `thaimora_project_url` (exact selected https://REF.supabase.co origin) and `thaimora_email_worker_secret` (identical worker secret). Keep decrypted Vault records unreadable by public roles.
3. Apply the operations SQL as database owner. That owner calls `select private.configure_email_outbox_scheduler('<verified-project-ref>');`. Cron stores only `select private.invoke_email_outbox();`, every5minutes. Each invocation revalidates origin/ref/secret and skips HTTP entirely when no work is due.
4. Pending/failed rows must be due; sending locks become eligible after10minutes. The worker atomically claims at most5tasks, concurrently, with8-second database/provider deadlines. Scheduler HTTP deadline is60seconds, above the bounded failed path. Stable inquiry idempotency keys protect retries if provider acceptance precedes a database failure.
5. Use an authorized test inquiry/recipient for actual delivery and retry. Monitor selected Cron/HTTP status fields and outbox statuses. A successful enqueue is not proof of delivery; pg_net's transient queue contains authorization headers and must stay private.
6. Pause only this job using `select private.pause_email_outbox_scheduler();`. Pause before rotating matching Edge/Vault secrets; validate before reconfiguring. After recovery, recreate secrets and configure the new project explicitly.

Local evidence: mocked-provider worker tests passed unauthorized rejection, concurrent6-second responses and8-second timeout followed by stable-key retry (`6ce4f1486a0d9e9e`). Scheduler SQL passed private role, due/stale eligibility, fixed deadline, destination and scoped pause checks (`9b164256552cbbff`). Those SQL tests model Vault/Cron/pg_net interfaces and do not prove real encryption or HTTP service operation. Actual hosted installation and Resend delivery remain unverified.

References: [scheduled Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions), [Vault](https://supabase.com/docs/guides/database/vault), [pg_net](https://supabase.com/docs/guides/database/extensions/pg_net).
