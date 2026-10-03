begin;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net;
do $$ begin
 if to_regclass('vault.decrypted_secrets') is null then
  raise exception 'Enable Supabase Vault before email scheduler installation';
 end if;
end $$;
create schema if not exists private;
revoke usage on schema private from public,anon,authenticated;
create table if not exists private.email_scheduler_config(
 singleton boolean primary key default true check(singleton),
 expected_project_ref text not null check(expected_project_ref ~ '^[a-z0-9]{20}$')
);
alter table private.email_scheduler_config enable row level security;
revoke all on private.email_scheduler_config from public,anon,authenticated,service_role;
create or replace function private.invoke_email_outbox()
returns bigint language plpgsql security definer set search_path=pg_catalog as $$
declare project_ref text; project_url text; worker_secret text; request_id bigint;
begin
 select expected_project_ref into project_ref from private.email_scheduler_config where singleton;
 select decrypted_secret into project_url from vault.decrypted_secrets where name='thaimora_project_url';
 select decrypted_secret into worker_secret from vault.decrypted_secrets where name='thaimora_email_worker_secret';
 if project_ref is null or project_ref !~ '^[a-z0-9]{20}$'
  or project_url is null or project_url <> ('https://' || project_ref || '.supabase.co')
  or worker_secret is null or length(worker_secret) not between 32 and 256 or worker_secret !~ '^[A-Za-z0-9_-]+$' then
  raise exception 'Email scheduler configuration missing or invalid';
 end if;
 if not pg_try_advisory_xact_lock(hashtextextended('thaimora-email-outbox-retry',0)) then return null; end if;
 if not exists(select 1 from public.email_outbox
  where (status in ('pending','failed') and next_attempt_at<=now())
   or (status='sending' and locked_at<now()-interval '10 minutes')) then return null; end if;
 request_id:=net.http_post(
  url:=project_url || '/functions/v1/deliver-email',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || worker_secret),
  body:='{}'::jsonb,timeout_milliseconds:=60000);
 return request_id;
end $$;
revoke all on function private.invoke_email_outbox() from public,anon,authenticated,service_role;
create or replace function private.configure_email_outbox_scheduler(p_project_ref text)
returns bigint language plpgsql security definer set search_path=pg_catalog as $$
declare project_url text; worker_secret text; job_id bigint;
begin
 if p_project_ref is null or p_project_ref !~ '^[a-z0-9]{20}$' then
  raise exception 'Verified Supabase project ref required';
 end if;
 select decrypted_secret into project_url from vault.decrypted_secrets where name='thaimora_project_url';
 select decrypted_secret into worker_secret from vault.decrypted_secrets where name='thaimora_email_worker_secret';
 if project_url is null or project_url <> ('https://' || p_project_ref || '.supabase.co')
  or worker_secret is null or length(worker_secret) not between 32 and 256 or worker_secret !~ '^[A-Za-z0-9_-]+$' then
  raise exception 'Set vetted project URL and worker secret in Supabase Vault first';
 end if;
 if has_table_privilege('anon','vault.decrypted_secrets','SELECT')
  or has_table_privilege('authenticated','vault.decrypted_secrets','SELECT') then
  raise exception 'Vault decrypted secrets must be inaccessible to public roles';
 end if;
 insert into private.email_scheduler_config(singleton,expected_project_ref) values(true,p_project_ref)
  on conflict(singleton) do update set expected_project_ref=excluded.expected_project_ref;
 job_id:=cron.schedule('thaimora-email-outbox-retry','*/5 * * * *','select private.invoke_email_outbox();');
 return job_id;
end $$;
revoke all on function private.configure_email_outbox_scheduler(text) from public,anon,authenticated,service_role;
create or replace function private.pause_email_outbox_scheduler()
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare job_id bigint;
begin
 for job_id in select jobid from cron.job where jobname='thaimora-email-outbox-retry' and username=current_user loop
  perform cron.unschedule(job_id);
 end loop;
end $$;
revoke all on function private.pause_email_outbox_scheduler() from public,anon,authenticated,service_role;
revoke all on net.http_request_queue,net._http_response from public,anon,authenticated;
commit;
