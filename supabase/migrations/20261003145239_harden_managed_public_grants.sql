-- Managed Supabase defaults can grant ALL before the application's grants.
-- Restore explicit anonymous read surfaces; RLS remains a separate boundary.
revoke all privileges on all tables in schema public from public,anon;
revoke all privileges on all sequences in schema public from public,anon;
-- Staff RLS allows DML, not TRUNCATE (which bypasses RLS) or DDL-like rights.
revoke truncate,references,trigger on all tables in schema public from authenticated;
revoke all privileges on sequence public.admin_audit_log_id_seq from authenticated;
do $$begin
 if current_setting('server_version_num')::integer>=170000 then
  execute 'revoke maintain on all tables in schema public from authenticated';
 end if;
end $$;
-- Future objects owned by the migration role also require explicit public grants.
alter default privileges in schema public revoke all privileges on tables from public,anon,authenticated;
alter default privileges in schema public grant select,insert,update,delete on tables to authenticated;
alter default privileges in schema public revoke all privileges on sequences from public,anon;

-- Exact public column lists from 202610030011_atomic_admin.sql.
grant select(id,slug,title,description,transaction,type,price_thb,area_m2,land_area_m2,beds,baths,floor,built_year,ownership,furnishing,status,public_location,zone,province,amenities,published,demo,rights_status,updated_at,expires_at,source_url) on public.properties to anon;
grant select(id,property_id,url,alt,credit,source_url,rights_status,position) on public.property_images to anon;
grant select(id,name,description,category,location,zone_id,image,source_url,website,demo,source,license,fetched_at,source_updated_at,published,rights_status) on public.pois to anon;
grant select(id,name,description,starts_at,ends_at,location,zone_id,image,source_url,demo,source,license,fetched_at,source_updated_at,published,rights_status) on public.events to anon;
grant select on public.zones,public.fx_rates,public.public_pois,public.public_events to anon;
grant select on public.public_properties to anon;
