-- OFF until real accounts are configured. Queued auth is short-lived, never a bearer.
begin;
create table private.contact_worker_nonces(nonce uuid primary key,created_at timestamptz not null default now());
alter table private.contact_worker_nonces enable row level security;
revoke all on private.contact_worker_nonces from public,anon,authenticated;
grant select,insert,delete on private.contact_worker_nonces to service_role;
create function public.consume_contact_nonce(p_nonce uuid,p_timestamp bigint) returns boolean
 language plpgsql security definer set search_path=pg_catalog,private as $$
begin
 if p_nonce is null or p_timestamp is null or p_timestamp<extract(epoch from now())::bigint-60 or p_timestamp>extract(epoch from now())::bigint+10 then return false;end if;
 delete from private.contact_worker_nonces where created_at<now()-interval '2 minutes';
 insert into private.contact_worker_nonces(nonce) values(p_nonce) on conflict(nonce) do nothing;
 return found;
end;$$;
revoke all on function public.consume_contact_nonce(uuid,bigint) from public,anon,authenticated;
grant execute on function public.consume_contact_nonce(uuid,bigint) to service_role;
create function private.invoke_contact_delivery() returns bigint
 language plpgsql security definer set search_path=pg_catalog,private,extensions as $$
declare target text;secret text;stamp text;nonce text;signature text;request_id bigint;ref text;
begin
 if not (select delivery_enabled from private.contact_config where singleton) then return null;end if;
 if not pg_try_advisory_xact_lock(hashtext('contact-delivery-schedule')) then return null;end if;
 if not exists(select 1 from private.contact_outbox where attempts<10 and created_at>now()-interval '23 hours'
 and((status in('pending','failed') and next_attempt_at<=now())or(status='sending' and lease_until<=now()))) then return null;end if;
 select decrypted_secret into target from vault.decrypted_secrets where name='contact_worker_url';
 select decrypted_secret into secret from vault.decrypted_secrets where name='contact_worker_secret';
 select expected_project_ref into ref from private.content_scheduler_config where singleton;
 if target is null or target !~ '^https://[a-z0-9]{20}\.supabase\.co/functions/v1/deliver-contact$' or secret is null or secret !~ '^[a-f0-9]{64}$' then raise exception 'Contact worker is not configured';end if;
 if ref is null or target<>'https://'||ref||'.supabase.co/functions/v1/deliver-contact' then raise exception 'Contact worker project mismatch';end if;
 stamp:=floor(extract(epoch from now()))::bigint::text;nonce:=gen_random_uuid()::text;
 signature:=encode(extensions.hmac('contact-delivery-v1'||chr(10)||stamp||chr(10)||nonce||chr(10)||target,secret,'sha256'),'hex');
 select net.http_post(url:=target,headers:=jsonb_build_object('Content-Type','application/json','X-Contact-Timestamp',stamp,'X-Contact-Nonce',nonce,'X-Contact-Signature',signature),body:='{}'::jsonb,timeout_milliseconds:=60000) into request_id;
 return request_id;
end;$$;
revoke all on function private.invoke_contact_delivery() from public,anon,authenticated,service_role;
create function public.configure_contact_scheduler(p_project_url text,p_secret text,p_enabled boolean default false) returns jsonb
 language plpgsql security definer set search_path=pg_catalog,private as $$
declare existing uuid;job bigint;ref text;
begin
 if p_project_url is null or p_project_url !~ '^https://[a-z0-9]{20}\.supabase\.co$' then raise exception 'Exact project URL required';end if;
 if p_enabled is distinct from false and p_enabled is distinct from true then raise exception 'Explicit activation required';end if;
 if p_enabled then
  select expected_project_ref into ref from private.content_scheduler_config where singleton;
  if ref is null or p_project_url<>'https://'||ref||'.supabase.co' then raise exception 'Contact worker project mismatch';end if;
  if has_table_privilege('anon','vault.decrypted_secrets','SELECT') or has_table_privilege('authenticated','vault.decrypted_secrets','SELECT') then raise exception 'Vault must remain private';end if;
  if p_secret is null or p_secret !~ '^[a-f0-9]{64}$' then raise exception 'Private worker secret required';end if;
  select id into existing from vault.secrets where name='contact_worker_url';
  if existing is null then perform vault.create_secret(p_project_url||'/functions/v1/deliver-contact','contact_worker_url');
  else perform vault.update_secret(existing,p_project_url||'/functions/v1/deliver-contact','contact_worker_url');end if;
  select id into existing from vault.secrets where name='contact_worker_secret';
  if existing is null then perform vault.create_secret(p_secret,'contact_worker_secret');
  else perform vault.update_secret(existing,p_secret,'contact_worker_secret');end if;
  select cron.schedule('contact-delivery-schedule','* * * * *','select private.invoke_contact_delivery()') into job;
 else
  for job in select jobid from cron.job where jobname='contact-delivery-schedule' loop perform cron.unschedule(job);end loop;
 end if;
 update private.contact_config set delivery_enabled=p_enabled where singleton;
 return jsonb_build_object('enabled',p_enabled,'jobId',case when p_enabled then job end);
end;$$;
revoke all on function public.configure_contact_scheduler(text,text,boolean) from public,anon,authenticated;
grant execute on function public.configure_contact_scheduler(text,text,boolean) to service_role;
commit;
