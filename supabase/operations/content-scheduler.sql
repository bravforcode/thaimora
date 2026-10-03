-- Configured through service-role-only configure_content_scheduler after worker deployment.
-- Send credentials from a protected environment file through HTTPS, never SQL editor/logs.
-- The migration binds the target project, Vault secrets and only content-sync-schedule.
select jobid,jobname,schedule,active from cron.job where jobname='content-sync-schedule';
select id,kind,enabled,status,checked_at,last_success_at,next_due_at,failures from private.content_sources order by id;
-- Owner-only pause, preserving other jobs:
-- select cron.unschedule(jobid) from cron.job where jobname='content-sync-schedule' and username=current_user;
