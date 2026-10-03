-- Private bounded ingestion; public clocks exclude expired events without deleting history.
begin;
create schema if not exists private;
revoke all on schema private from public,anon,authenticated;
create table private.content_revision(
 singleton boolean primary key default true check(singleton),
 revision bigint not null default 1,pois bigint not null default 1,events bigint not null default 1,home bigint not null default 1
);
insert into private.content_revision(singleton) values(true);
create table private.content_sources(
 id text primary key check(id in ('frankfurter','tat-metadata','organizer-json','osm-overpass')),
 kind text not null check(kind in ('fx','catalog','events','pois')),
 enabled boolean not null default false,endpoint text,public_source_url text,license text,rights_evidence text,
 rights_confirmed boolean not null default false,bbox jsonb,
 interval_seconds integer not null default 86400 check(interval_seconds between 300 and 604800),
 next_due_at timestamptz not null default now(),checked_at timestamptz,last_success_at timestamptz,source_updated_at timestamptz,
 source_version text check(length(source_version)<=128),upstream_etag text check(length(upstream_etag)<=200),
 failures integer not null default 0 check(failures between 0 and 20),
 status text not null default 'awaiting_source' check(status in ('awaiting_source','license_pending','ready','syncing','error')),
 error_code text check(error_code in ('upstream_unavailable','upstream_timeout','source_too_large','invalid_source','database_unavailable','lease_expired')),
 lease_token uuid,lease_until timestamptz,active_run_id uuid references public.sync_runs(id),
 check(endpoint is null or endpoint ~ '^https://[^[:space:]]+$'),
 check(not rights_confirmed or (length(btrim(coalesce(license,'')))>0 and length(btrim(coalesce(rights_evidence,'')))>0)),
 check(id<>'frankfurter' or (kind='fx' and endpoint='https://api.frankfurter.dev/v2/providers/ecb/rates?base=THB')),
 check(id<>'tat-metadata' or (kind='catalog' and endpoint='https://datacatalog.tat.or.th/api/3/action/package_show?id=tourismactivity')),
 check(id<>'organizer-json' or kind='events'),check(id<>'osm-overpass' or kind='pois')
);
create table private.content_tombstones(table_name text not null check(table_name in ('pois','events')),id text not null,deleted_at timestamptz not null default now(),primary key(table_name,id));
alter table private.content_revision enable row level security;
alter table private.content_sources enable row level security;
alter table private.content_tombstones enable row level security;
revoke all on private.content_revision,private.content_sources,private.content_tombstones from public,anon,authenticated,service_role;
insert into private.content_sources(id,kind,enabled,endpoint,status) values
 ('frankfurter','fx',true,'https://api.frankfurter.dev/v2/providers/ecb/rates?base=THB','awaiting_source'),
 ('tat-metadata','catalog',true,'https://datacatalog.tat.or.th/api/3/action/package_show?id=tourismactivity','license_pending'),
 ('organizer-json','events',false,null,'awaiting_source'),
 ('osm-overpass','pois',false,null,'awaiting_source');
create index content_sources_due on private.content_sources(next_due_at) where enabled;
create index events_expiry_public on public.events(ends_at) where published and rights_status='approved' and not demo;
create or replace function public.content_is_public(p_table text,p_id text) returns boolean language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare r jsonb;begin
 if p_table='pois' then select to_jsonb(t) into r from public.pois t where id=p_id;
 elsif p_table='events' then select to_jsonb(t) into r from public.events t where id=p_id;
 else return false;end if;
 return coalesce((r->>'published')::boolean,false) and public.review_licensed_content(r)
 and (p_table<>'events' or ((r->>'ends_at')::timestamptz>now() and (r->>'ends_at')::timestamptz>(r->>'starts_at')::timestamptz));
end;$$;
revoke all on function public.content_is_public(text,text) from public;
grant execute on function public.content_is_public(text,text) to anon,authenticated,service_role;
create function private.bump_content_revision() returns trigger language plpgsql security definer set search_path=pg_catalog,private as $$
begin
 if tg_op='UPDATE' and to_jsonb(new)=to_jsonb(old) then return new;end if;
 update private.content_revision set revision=revision+1,
 pois=pois+case when tg_table_name='pois' then 1 else 0 end,
 events=events+case when tg_table_name='events' then 1 else 0 end,
 home=home+case when tg_table_name in ('site_settings','hotels','hotel_images','hotel_provider_ids','hotel_amenities','hotel_content','zones') then 1 else 0 end;
 if tg_op='DELETE' then return old;else return new;end if;
end;$$;
revoke all on function private.bump_content_revision() from public,anon,authenticated,service_role;
create trigger content_revision after insert or update or delete on public.pois for each row execute function private.bump_content_revision();
create trigger content_revision after insert or update or delete on public.events for each row execute function private.bump_content_revision();
create trigger content_source_revision after insert or update or delete on private.content_sources for each row execute function private.bump_content_revision();
do $$declare t text;begin
 foreach t in array array['site_settings','hotels','hotel_images','hotel_provider_ids','hotel_amenities','hotel_content','zones'] loop
  if to_regclass('public.'||t) is not null then execute format('create trigger content_home_revision after insert or update or delete on public.%I for each row execute function private.bump_content_revision()',t);end if;
 end loop;
end$$;
create function private.remember_content_deletion() returns trigger language plpgsql security definer set search_path=pg_catalog,private as $$
begin insert into private.content_tombstones(table_name,id) values(tg_table_name,old.id) on conflict do nothing;return old;end;$$;
revoke all on function private.remember_content_deletion() from public,anon,authenticated,service_role;
create trigger content_tombstone before delete on public.pois for each row execute function private.remember_content_deletion();
create trigger content_tombstone before delete on public.events for each row execute function private.remember_content_deletion();
create function public.public_content_meta() returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare v private.content_revision;boundary timestamptz;next_expiry timestamptz;sources jsonb;facet text;begin
 select * into v from private.content_revision where singleton;
 select ends_at into boundary from public.events e where e.published and e.rights_status='approved' and not e.demo and ends_at<=now() and public.review_licensed_content(to_jsonb(e)) order by ends_at desc limit 1;
 select ends_at into next_expiry from public.events e where e.published and e.rights_status='approved' and not e.demo and ends_at>now() and public.review_licensed_content(to_jsonb(e)) order by ends_at limit 1;
 facet:=coalesce(extract(epoch from boundary)::text,'none');
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'enabled',enabled,'status',status,'checkedAt',checked_at,'lastSuccessAt',last_success_at,'sourceUpdatedAt',source_updated_at,'nextDueAt',case when enabled then next_due_at else null end) order by id),'[]'::jsonb) into sources from private.content_sources;
 return jsonb_build_object('revision',v.revision::text||':'||facet,'poisVersion',v.pois::text,'eventsVersion',v.events::text||':'||facet,'homeVersion',v.home::text,'nextEventExpiryAt',next_expiry,'sources',sources);
end;$$;
revoke all on function public.public_content_meta() from public;
grant execute on function public.public_content_meta() to anon,authenticated,service_role;
create function public.claim_content_sources(p_limit integer default 2) returns setof jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare s private.content_sources;r uuid;begin
 if p_limit not between 1 and 2 then raise exception 'Invalid source claim limit';end if;
 for s in select * from private.content_sources where enabled and next_due_at<=now() and (lease_until is null or lease_until<now()) order by next_due_at,id limit p_limit for update skip locked loop
  if s.active_run_id is not null then update public.sync_runs set status='failed',finished_at=now(),error_count=1,detail='{"code":"lease_expired"}' where id=s.active_run_id and status='running';end if;
  insert into public.sync_runs(source,status) values(s.id,'running') returning id into r;
  update private.content_sources set lease_token=gen_random_uuid(),lease_until=now()+interval '3 minutes',active_run_id=r,status='syncing',error_code=null where id=s.id returning * into s;
  return next jsonb_build_object('id',s.id,'kind',s.kind,'endpoint',s.endpoint,'publicSourceUrl',s.public_source_url,'license',s.license,'rightsConfirmed',s.rights_confirmed,'bbox',s.bbox,'lease',s.lease_token,'version',s.source_version,'etag',s.upstream_etag);
 end loop;
end;$$;
revoke all on function public.claim_content_sources(integer) from public,anon,authenticated;
grant execute on function public.claim_content_sources(integer) to service_role;
create function public.finish_content_source(p_id text,p_lease uuid,p_version text,p_source_updated timestamptz,p_rows jsonb default '[]',p_fx jsonb default null,p_rows_read integer default 0,p_etag text default null,p_complete boolean default false)
 returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare s private.content_sources;r jsonb;old_row public.events;written integer:=0;skipped integer:=0;rid text;changed_rights boolean;begin
 select * into s from private.content_sources where id=p_id for update;
 if not found or not s.enabled or p_lease is null or s.lease_token is null or s.lease_until is null or s.active_run_id is null or s.lease_token is distinct from p_lease or s.lease_until<=now() then raise exception 'Stale or unavailable source lease';end if;
 if length(p_version)>128 or length(p_etag)>200 or p_rows_read not between 0 and 10000 or jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows)>500 or octet_length(p_rows::text)>1000000 then raise exception 'Invalid bounded source batch';end if;
 if s.kind='fx' then
  if p_fx is null or jsonb_typeof(p_fx->'rates') is distinct from 'object' or p_fx->>'base' is distinct from 'THB' or (p_fx->>'as_of') !~ '^\d{4}-\d{2}-\d{2}$' or (p_fx->>'as_of')::date>current_date or (select count(*) from jsonb_object_keys(p_fx->'rates')) not between 1 and 64
   or exists(select 1 from jsonb_each(p_fx->'rates') q where q.key !~ '^[A-Z]{3}$' or jsonb_typeof(q.value)<>'number' or (q.value::text)::numeric<=0) or jsonb_array_length(p_rows)>0 then raise exception 'Invalid ECB quote batch';end if;
  insert into public.fx_rates(base,rates,source,as_of,fetched_at) values('THB',p_fx->'rates','European Central Bank via Frankfurter v2',(p_fx->>'as_of')::date,now()) on conflict(base) do update set rates=excluded.rates,source=excluded.source,as_of=excluded.as_of,fetched_at=excluded.fetched_at;
  written:=1;
 elsif s.kind='catalog' then
  if jsonb_array_length(p_rows)>0 or p_fx is not null then raise exception 'Metadata checks cannot import event data';end if;
 elsif s.id='organizer-json' and s.rights_confirmed then
  if s.public_source_url is null or s.public_source_url !~ '^https://[^[:space:]]+$' or p_fx is not null or p_complete is distinct from true then raise exception 'Reviewed complete organizer snapshot required';end if;
  -- Serializes deletion/tombstone insertion with admission, including a missing row.
  lock table public.events in share row exclusive mode;
  for r in select value from jsonb_array_elements(p_rows) loop
   if r->>'id' !~ '^organizer-json:[A-Za-z0-9_-]{1,100}$' or jsonb_typeof(r->'name') is distinct from 'object' or length(btrim(coalesce(r->'name'->>'en','')))=0 or length(btrim(coalesce(r->'name'->>'th','')))=0 or length(r->'name'->>'en')>300 or length(r->'name'->>'th')>300
    or jsonb_typeof(r->'location'->'lat') is distinct from 'number' or jsonb_typeof(r->'location'->'lng') is distinct from 'number'
    or (r->'location'->>'lat')::numeric not between -90 and 90 or (r->'location'->>'lng')::numeric not between -180 and 180
    or (r->>'ends_at')::timestamptz<=(r->>'starts_at')::timestamptz then raise exception 'Invalid organizer event';end if;
   rid:=r->>'id';
   if exists(select 1 from private.content_tombstones where table_name='events' and id=rid) then skipped:=skipped+1;continue;end if;
   select * into old_row from public.events where id=rid for update;
   if found and (old_row.admin_override or old_row.rights_status='rejected') then skipped:=skipped+1;continue;end if;
   changed_rights:=found and (old_row.source is distinct from s.id or old_row.source_url is distinct from s.public_source_url or old_row.license is distinct from s.license);
   insert into public.events(id,name,description,starts_at,ends_at,location,source,source_url,license,rights_status,rights_evidence,published,demo,admin_override,fetched_at,source_updated_at)
   values(rid,r->'name',coalesce(r->'description','{}'::jsonb),(r->>'starts_at')::timestamptz,(r->>'ends_at')::timestamptz,r->'location',s.id,s.public_source_url,s.license,'approved',s.rights_evidence,true,false,false,now(),p_source_updated)
   on conflict(id) do update set name=excluded.name,description=excluded.description,starts_at=excluded.starts_at,ends_at=excluded.ends_at,location=excluded.location,source=excluded.source,source_url=excluded.source_url,license=excluded.license,
    rights_status=case when changed_rights then 'pending' else events.rights_status end,rights_evidence=case when changed_rights then null else events.rights_evidence end,published=case when changed_rights then false else events.published end,fetched_at=excluded.fetched_at,source_updated_at=excluded.source_updated_at
   where not events.admin_override and events.rights_status<>'rejected';
   if found then written:=written+1;else skipped:=skipped+1;end if;
  end loop;
  -- Complete snapshots explicitly withdraw removed/cancelled events; never delete history.
  update public.events e set published=false where e.source=s.id and e.published and not e.admin_override and e.rights_status<>'rejected'
   and not exists(select 1 from jsonb_array_elements(p_rows) r where r->>'id'=e.id);
 else raise exception 'Source adapter is not reviewed or implemented';end if;
 update public.sync_runs set status='completed',finished_at=now(),rows_read=p_rows_read,rows_written=written,source_version=p_version,detail=jsonb_build_object('skippedProtected',skipped,'metadataOnly',s.kind='catalog') where id=s.active_run_id;
 update private.content_sources set checked_at=now(),last_success_at=now(),source_updated_at=p_source_updated,source_version=p_version,upstream_etag=p_etag,failures=0,error_code=null,status=case when kind='catalog' and not rights_confirmed then 'license_pending' else 'ready' end,next_due_at=now()+make_interval(secs=>interval_seconds),lease_token=null,lease_until=null,active_run_id=null where id=s.id;
 delete from public.source_quarantine where source=s.id and created_at<now()-interval '30 days';
 delete from public.sync_runs where source=s.id and status<>'running' and started_at<now()-interval '90 days';
 return jsonb_build_object('written',written,'skipped',skipped,'metadataOnly',s.kind='catalog');
end;$$;
revoke all on function public.finish_content_source(text,uuid,text,timestamptz,jsonb,jsonb,integer,text,boolean) from public,anon,authenticated;
grant execute on function public.finish_content_source(text,uuid,text,timestamptz,jsonb,jsonb,integer,text,boolean) to service_role;
create function public.fail_content_source(p_id text,p_lease uuid,p_code text) returns boolean language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare s private.content_sources;code text;begin
 select * into s from private.content_sources where id=p_id for update;
 if not found or not s.enabled or p_lease is null or s.lease_token is null or s.lease_until is null or s.active_run_id is null or s.lease_token is distinct from p_lease or s.lease_until<=now() then return false;end if;
 code:=case when p_code=any(array['upstream_unavailable','upstream_timeout','source_too_large','invalid_source','database_unavailable']) then p_code else 'invalid_source' end;
 update public.sync_runs set status='failed',finished_at=now(),error_count=1,detail=jsonb_build_object('code',code) where id=s.active_run_id;
 update private.content_sources set checked_at=now(),failures=least(failures+1,20),status='error',error_code=code,next_due_at=now()+make_interval(secs=>least(3600,300*power(2,least(failures,4))::integer)),lease_token=null,lease_until=null,active_run_id=null where id=s.id;
 if code='invalid_source' then insert into public.source_quarantine(source,reason,payload) values(s.id,'invalid_source','{"batchRejected":true,"rawPayloadStored":false}');end if;
 delete from public.source_quarantine where source=s.id and created_at<now()-interval '30 days';
 delete from public.sync_runs where source=s.id and status<>'running' and started_at<now()-interval '90 days';
 return true;
end;$$;
revoke all on function public.fail_content_source(text,uuid,text) from public,anon,authenticated;
grant execute on function public.fail_content_source(text,uuid,text) to service_role;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net;
create table private.content_scheduler_config(singleton boolean primary key default true check(singleton),expected_project_ref text not null check(expected_project_ref ~ '^[a-z0-9]{20}$'));
alter table private.content_scheduler_config enable row level security;
revoke all on private.content_scheduler_config from public,anon,authenticated,service_role;
create function private.invoke_content_sync() returns bigint language plpgsql security definer set search_path=pg_catalog as $$
declare target text;secret text;ref text;begin
 select expected_project_ref into ref from private.content_scheduler_config where singleton;
 select decrypted_secret into target from vault.decrypted_secrets where name='content_sync_api_url';
 select decrypted_secret into secret from vault.decrypted_secrets where name='content_sync_worker_secret';
 if target is distinct from ('https://'||ref||'.supabase.co/functions/v1/sync-content') or secret is null or secret !~ '^[a-f0-9]{64}$' then raise exception 'Content scheduler is not configured';end if;
 if not exists(select 1 from private.content_sources where enabled and next_due_at<=now() and (lease_until is null or lease_until<now())) then return null;end if;
 if not pg_try_advisory_xact_lock(hashtextextended('content-sync-schedule',0)) then return null;end if;
 return net.http_post(url:=target,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||secret),body:='{}'::jsonb,timeout_milliseconds:=90000);
end;$$;
revoke all on function private.invoke_content_sync() from public,anon,authenticated,service_role;
create function public.configure_content_scheduler(p_worker_secret text,p_api_url text) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare ref text;prior_ref text;sid uuid;jid bigint;begin
 if p_worker_secret is null or p_worker_secret !~ '^[a-f0-9]{64}$' or p_api_url is null or p_api_url !~ '^https://[a-z0-9]{20}\.supabase\.co/functions/v1/sync-content$' then raise exception 'Canonical project worker URL and 64-hex secret required';end if;
 ref:=substring(p_api_url from '^https://([a-z0-9]{20})\.supabase\.co/');
 select expected_project_ref into prior_ref from private.content_scheduler_config where singleton;
 if prior_ref is not null and prior_ref<>ref then raise exception 'Scheduler is bound to a different project; owner reconfiguration required';end if;
 if has_table_privilege('anon','vault.decrypted_secrets','SELECT') or has_table_privilege('authenticated','vault.decrypted_secrets','SELECT') then raise exception 'Vault must be inaccessible to public roles';end if;
 insert into private.content_scheduler_config(singleton,expected_project_ref) values(true,ref) on conflict(singleton) do nothing;
 select id into sid from vault.secrets where name='content_sync_worker_secret';
 if sid is null then perform vault.create_secret(p_worker_secret,'content_sync_worker_secret','Private content worker bearer');else perform vault.update_secret(sid,p_worker_secret,'content_sync_worker_secret','Private content worker bearer');end if;
 select id into sid from vault.secrets where name='content_sync_api_url';
 if sid is null then perform vault.create_secret(p_api_url,'content_sync_api_url','Exact project content worker URL');else perform vault.update_secret(sid,p_api_url,'content_sync_api_url','Exact project content worker URL');end if;
 jid:=cron.schedule('content-sync-schedule','*/5 * * * *','select private.invoke_content_sync();');
 return jsonb_build_object('configured',true,'jobId',jid,'schedule','*/5 * * * *');
end;$$;
revoke all on function public.configure_content_scheduler(text,text) from public,anon,authenticated;
grant execute on function public.configure_content_scheduler(text,text) to service_role;
revoke all on net.http_request_queue,net._http_response from public,anon,authenticated,service_role;
commit;
