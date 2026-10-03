create table public.osm_pois (
  id text primary key,payload jsonb not null,source_url text not null,license text not null,fetched_at timestamptz not null
);
alter table osm_pois enable row level security;
create policy osm_admin on osm_pois for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant all on osm_pois to service_role;
grant select,insert,update,delete on osm_pois to authenticated;

alter table properties add column admin_override boolean not null default false;
alter table property_images add column rights_evidence text;
