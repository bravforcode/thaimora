-- Managed pg_net queue grants cannot be changed by the tenant owner. Never queue a permanent bearer.
begin;
create table private.content_sync_nonces(nonce uuid primary key,used_at timestamptz not null default clock_timestamp());
alter table private.content_sync_nonces enable row level security;
revoke all on private.content_sync_nonces from public,anon,authenticated,service_role;
create function public.consume_content_sync_nonce(p_nonce uuid,p_timestamp bigint) returns boolean language plpgsql security definer set search_path=pg_catalog as $$
declare consumed uuid;seconds bigint:=floor(extract(epoch from clock_timestamp()))::bigint;begin
 if p_nonce is null or p_timestamp is null or p_timestamp<seconds-60 or p_timestamp>seconds+10 then return false;end if;
 delete from private.content_sync_nonces where used_at<clock_timestamp()-interval '2 minutes';
 insert into private.content_sync_nonces(nonce) values(p_nonce) on conflict do nothing returning nonce into consumed;
 return consumed is not null;
end;$$;
revoke all on function public.consume_content_sync_nonce(uuid,bigint) from public,anon,authenticated;
grant execute on function public.consume_content_sync_nonce(uuid,bigint) to service_role;
create or replace function private.invoke_content_sync() returns bigint language plpgsql security definer set search_path=pg_catalog as $$
declare target text;secret text;ref text;stamp text;nonce text;message text;signature text;begin
 select expected_project_ref into ref from private.content_scheduler_config where singleton;
 select decrypted_secret into target from vault.decrypted_secrets where name='content_sync_api_url';
 select decrypted_secret into secret from vault.decrypted_secrets where name='content_sync_worker_secret';
 if target is distinct from ('https://'||ref||'.supabase.co/functions/v1/sync-content') or secret is null or secret !~ '^[a-f0-9]{64}$' then raise exception 'Content scheduler is not configured';end if;
 if not exists(select 1 from private.content_sources where enabled and next_due_at<=now() and (lease_until is null or lease_until<now())) then return null;end if;
 if not pg_try_advisory_xact_lock(hashtextextended('content-sync-schedule',0)) then return null;end if;
 stamp:=floor(extract(epoch from clock_timestamp()))::bigint::text;nonce:=gen_random_uuid()::text;
 message:='content-sync-v1'||E'\n'||stamp||E'\n'||nonce||E'\n'||target;
 signature:=encode(extensions.hmac(message,secret,'sha256'),'hex');
 return net.http_post(url:=target,headers:=jsonb_build_object('Content-Type','application/json','X-Content-Timestamp',stamp,'X-Content-Nonce',nonce,'X-Content-Signature',signature),body:='{}'::jsonb,timeout_milliseconds:=90000);
end;$$;
revoke all on function private.invoke_content_sync() from public,anon,authenticated,service_role;
commit;
