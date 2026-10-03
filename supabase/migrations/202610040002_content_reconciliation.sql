-- Correct source snapshot withdrawal, restore approved reappearances and atomic admin automation release.
begin;
create or replace function public.finish_content_source(p_id text,p_lease uuid,p_version text,p_source_updated timestamptz,p_rows jsonb default '[]',p_fx jsonb default null,p_rows_read integer default 0,p_etag text default null,p_complete boolean default false)
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
    rights_status=case when changed_rights then 'pending' else events.rights_status end,rights_evidence=case when changed_rights then null else events.rights_evidence end,published=case when changed_rights then false when events.rights_status='approved' and excluded.ends_at>now() then true else events.published end,fetched_at=excluded.fetched_at,source_updated_at=excluded.source_updated_at
   where not events.admin_override and events.rights_status<>'rejected';
   if found then written:=written+1;else skipped:=skipped+1;end if;
  end loop;
  -- Complete snapshots explicitly withdraw removed/cancelled events; never delete history.
  update public.events e set published=false where e.source=s.id and e.published and not e.admin_override and e.rights_status<>'rejected'
   and not exists(select 1 from jsonb_array_elements(p_rows) incoming(row_json) where incoming.row_json->>'id'=e.id);
 else raise exception 'Source adapter is not reviewed or implemented';end if;
 update public.sync_runs set status='completed',finished_at=now(),rows_read=p_rows_read,rows_written=written,source_version=p_version,detail=jsonb_build_object('skippedProtected',skipped,'metadataOnly',s.kind='catalog') where id=s.active_run_id;
 update private.content_sources set checked_at=now(),last_success_at=now(),source_updated_at=p_source_updated,source_version=p_version,upstream_etag=p_etag,failures=0,error_code=null,status=case when kind='catalog' and not rights_confirmed then 'license_pending' else 'ready' end,next_due_at=now()+make_interval(secs=>interval_seconds),lease_token=null,lease_until=null,active_run_id=null where id=s.id;
 delete from public.source_quarantine where source=s.id and created_at<now()-interval '30 days';
 delete from public.sync_runs where source=s.id and status<>'running' and started_at<now()-interval '90 days';
 return jsonb_build_object('written',written,'skipped',skipped,'metadataOnly',s.kind='catalog');
end;$$;
create function public.admin_release_content_override(p_table text,p_id text,p_actor uuid)
 returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare present text;begin
 if p_table is null or p_table not in ('pois','events') or p_id is null or length(p_id) not between 1 and 200 or p_actor is null or not exists(select 1 from public.admin_memberships where user_id=p_actor) then raise exception 'Validated admin and content resource required';end if;
 execute format('select id from public.%I where id=$1 for update',p_table) into present using p_id;
 if present is null then raise exception 'Content record not found';end if;
 execute format('update public.%I set admin_override=false where id=$1',p_table) using p_id;
 insert into public.admin_audit_log(actor_id,actor_kind,actor_source,table_name,record_id,operation,metadata)
 values(p_actor,'authenticated-admin','validated-admin-api',p_table,p_id,'ADMIN_ACTION',jsonb_build_object('operation','UPDATE','fields',jsonb_build_array('admin_override'),'automaticSyncEnabled',true));
 return jsonb_build_object('id',p_id,'adminOverride',false,'automaticSyncEnabled',true);
end;$$;
revoke all on function public.admin_release_content_override(text,text,uuid) from public,anon,authenticated;
grant execute on function public.admin_release_content_override(text,text,uuid) to service_role;
commit;
