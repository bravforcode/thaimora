-- Synthetic privilege regression against managed-default ALL grants.
-- A successful SELECT returning zero rows is not a demonstrated PII leak.
begin;
do $$declare t text;rel record;privilege text;begin
 foreach t in array array['admin_memberships','property_private_locations','inquiries','email_outbox','import_jobs','import_errors','daily_property_stats','site_settings','sync_runs','source_quarantine','rate_windows','osm_pois','admin_audit_log'] loop
  if has_table_privilege('anon','public.'||t,'SELECT') or has_any_column_privilege('anon','public.'||t,'SELECT') then raise exception 'Anonymous private table privilege remains: %',t;end if;
 end loop;
 for rel in select c.oid,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p','v') loop
  foreach privilege in array array['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
   if has_table_privilege('anon',rel.oid,privilege) then raise exception 'Anonymous unexpected privilege % on %',privilege,rel.relname;end if;
  end loop;
  foreach privilege in array array['INSERT','UPDATE','REFERENCES'] loop
   if has_any_column_privilege('anon',rel.oid,privilege) then raise exception 'Anonymous column write privilege % on %',privilege,rel.relname;end if;
  end loop;
  foreach privilege in array array['TRUNCATE','REFERENCES','TRIGGER'] loop
   if has_table_privilege('authenticated',rel.oid,privilege) then raise exception 'Authenticated privilege bypasses staff DML boundary: % on %',privilege,rel.relname;end if;
  end loop;
  if current_setting('server_version_num')::integer>=170000 then
   if has_table_privilege('anon',rel.oid,'MAINTAIN') or has_table_privilege('authenticated',rel.oid,'MAINTAIN') then raise exception 'Unexpected maintenance privilege on %',rel.relname;end if;
  end if;
 end loop;
 if has_column_privilege('anon','public.properties','ownership_evidence','SELECT') or has_column_privilege('authenticated','public.properties','ownership_evidence','SELECT') then raise exception 'Property evidence column grant broadened';end if;
 if not has_column_privilege('anon','public.properties','public_location','SELECT') then raise exception 'Safe public coordinates grant lost';end if;
 if has_column_privilege('anon','public.property_images','rights_evidence','SELECT') or has_column_privilege('authenticated','public.property_images','rights_evidence','SELECT') then raise exception 'Image proof column grant broadened';end if;
 if has_sequence_privilege('anon','public.admin_audit_log_id_seq','USAGE') or has_sequence_privilege('anon','public.admin_audit_log_id_seq','SELECT') or has_sequence_privilege('anon','public.admin_audit_log_id_seq','UPDATE') then raise exception 'Anonymous audit sequence access remains';end if;
 if has_sequence_privilege('authenticated','public.admin_audit_log_id_seq','USAGE') then raise exception 'Client audit sequence access remains';end if;
 if not has_sequence_privilege('service_role','public.admin_audit_log_id_seq','USAGE') then raise exception 'Server audit sequence access lost';end if;
 if has_table_privilege('authenticated','public.admin_audit_log','INSERT') then raise exception 'Client audit insertion grant broadened';end if;
 if not has_table_privilege('service_role','public.admin_audit_log','INSERT') then raise exception 'Server audit insertion grant lost';end if;
end $$;
set local role anon;
do $$declare t text;begin
 foreach t in array array['admin_memberships','property_private_locations','inquiries','email_outbox','import_jobs','import_errors','daily_property_stats','site_settings','sync_runs','source_quarantine','rate_windows','osm_pois','admin_audit_log'] loop
  begin execute format('select 1 from public.%I limit 1',t);raise exception 'Anonymous private table SELECT unexpectedly allowed: %',t;exception when insufficient_privilege then null;end;
 end loop;
 begin insert into public.zones(id,slug,name,location) values('acl-anon','acl-anon','{}','{"lat":10.08,"lng":99.83}');raise exception 'Anonymous zone insertion allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
-- No RLS policy can rescue an accidentally granted TRUNCATE permission.
set local role authenticated;
select set_config('request.jwt.claim.sub','',true);
do $$begin
 begin truncate public.zones cascade;raise exception 'Unaffiliated JWT can truncate content';exception when insufficient_privilege then null;end;
 begin insert into public.zones(id,slug,name,location) values('acl-nonstaff','acl-nonstaff','{}','{"lat":10.08,"lng":99.83}');raise exception 'Unaffiliated JWT bypassed staff RLS';exception when insufficient_privilege then null;end;
end $$;
reset role;
-- Preserve legitimate direct staff DML and its existing audit triggers.
insert into auth.users(id) values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into public.admin_memberships(user_id,role) values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','admin');
set local role authenticated;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
insert into public.zones(id,slug,name,location) values('acl-staff','acl-staff','{"en":"ACL test","th":"ACL test"}','{"lat":10.08,"lng":99.83}');
update public.zones set slug='acl-staff-updated' where id='acl-staff';
do $$begin if not exists(select 1 from public.zones where id='acl-staff' and slug='acl-staff-updated') then raise exception 'Legitimate staff DML denied';end if;end $$;
delete from public.zones where id='acl-staff';
reset role;
do $$begin
 if(select count(*) from public.admin_audit_log where table_name='zones' and record_id='acl-staff' and actor_source='database-trigger' and actor_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' and operation in ('INSERT','UPDATE','DELETE'))<>3 then raise exception 'Legitimate staff audit trail lost';end if;
end $$;
-- New application-owned objects must not inherit anonymous access before RLS.
create table public.managed_grant_probe(value text);
do $$declare privilege text;begin
 foreach privilege in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
  if has_table_privilege('anon','public.managed_grant_probe',privilege) then raise exception 'Future anonymous managed default grant remains: %',privilege;end if;
 end loop;
 foreach privilege in array array['SELECT','INSERT','UPDATE','DELETE'] loop
  if not has_table_privilege('authenticated','public.managed_grant_probe',privilege) then raise exception 'Future staff DML privilege lost: %',privilege;end if;
  if not has_table_privilege('service_role','public.managed_grant_probe',privilege) then raise exception 'Server default privilege lost: %',privilege;end if;
 end loop;
 foreach privilege in array array['TRUNCATE','REFERENCES','TRIGGER'] loop
  if has_table_privilege('authenticated','public.managed_grant_probe',privilege) then raise exception 'Future staff default privilege drift: %',privilege;end if;
 end loop;
 if current_setting('server_version_num')::integer>=170000 then
  if has_table_privilege('anon','public.managed_grant_probe','MAINTAIN') or has_table_privilege('authenticated','public.managed_grant_probe','MAINTAIN') then raise exception 'Future maintenance privilege drift';end if;
 end if;
end $$;
rollback;
select 'PASS: managed default grants hardened; private reads denied; public columns and staff/server flow retained' as result;
