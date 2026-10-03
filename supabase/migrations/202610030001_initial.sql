create extension if not exists postgis with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create table public.admin_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('editor','admin'))
);
create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from admin_memberships where user_id = auth.uid());
$$;
create table public.zones (
  id text primary key, slug text unique not null, name jsonb not null, description jsonb not null default '{}',
  location jsonb not null, geometry jsonb, image text, updated_at timestamptz not null default now()
);
create table public.pois (
  id text primary key, name jsonb not null, description jsonb not null default '{}', category text not null,
  location jsonb not null, zone_id text references zones(id), image text, website text,
  source text not null, source_url text not null, license text, rights_status text not null default 'pending' check(rights_status in ('pending','approved','rejected')),
  fetched_at timestamptz not null default now(), source_updated_at timestamptz, admin_override boolean not null default false,
  published boolean not null default false, demo boolean not null default false
);
create table public.events (
  id text primary key, name jsonb not null, description jsonb not null default '{}',
  starts_at timestamptz not null, ends_at timestamptz not null, all_day boolean not null default false,
  location jsonb not null, zone_id text references zones(id), image text,
  source text not null, source_url text not null, license text, rights_status text not null default 'pending' check(rights_status in ('pending','approved','rejected')),
  fetched_at timestamptz not null default now(), source_updated_at timestamptz, admin_override boolean not null default false,
  published boolean not null default false, demo boolean not null default false,
  check(ends_at > starts_at)
);
create table public.sync_runs (
  id uuid primary key default gen_random_uuid(), source text not null, status text not null,
  started_at timestamptz not null default now(), finished_at timestamptz, rows_read integer not null default 0,
  rows_written integer not null default 0, error_count integer not null default 0, source_version text, detail jsonb not null default '{}'
);
create table public.source_quarantine (
  id uuid primary key default gen_random_uuid(), source text not null, source_id text, reason text not null,
  payload jsonb not null, created_at timestamptz not null default now()
);
create table public.fx_rates (
  base text primary key default 'THB', rates jsonb not null, source text not null, as_of date not null, fetched_at timestamptz not null default now()
);
create table public.rate_windows (
  key_hash text not null, window_start timestamptz not null, hits integer not null default 1,
  primary key(key_hash,window_start)
);
create function public.take_rate_limit(p_key text,p_limit integer,p_seconds integer) returns boolean
language plpgsql security definer set search_path=public as $$
declare hits integer; window_at timestamptz;
begin
  window_at := to_timestamp(floor(extract(epoch from now())/p_seconds)*p_seconds);
  insert into rate_windows(key_hash,window_start) values(p_key,window_at)
  on conflict(key_hash,window_start) do update set hits=rate_windows.hits+1 returning rate_windows.hits into hits;
  delete from rate_windows where window_start < now()-interval '2 days';
  return hits <= p_limit;
end; $$;
revoke all on function public.take_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.take_rate_limit(text,integer,integer) to service_role;
alter table public.admin_memberships enable row level security;
create policy member_self on public.admin_memberships for select to authenticated using(user_id=auth.uid());
create policy members_owner on public.admin_memberships for all to authenticated using(
  exists(select 1 from public.admin_memberships m where m.user_id=auth.uid() and m.role='admin')
);

create table public.properties (
  id uuid primary key default gen_random_uuid(), slug text unique not null,
  title jsonb not null, description jsonb not null,
  transaction text not null check(transaction in ('sale','rent')),
  type text not null check(type in ('condo','house','villa','land','townhouse')),
  price_thb numeric not null check(price_thb>0), area_m2 numeric not null check(area_m2>0),
  land_area_m2 numeric check(land_area_m2>0), beds integer not null default 0 check(beds>=0), baths integer not null default 0 check(baths>=0),
  floor integer, built_year integer, ownership text not null check(ownership in ('freehold','leasehold','unknown')),
  furnishing text not null check(furnishing in ('furnished','partly_furnished','unfurnished')),
  status text not null default 'available' check(status in ('available','sold','rented')),
  public_location jsonb, zone text not null, province text not null, amenities text[] not null default '{}',
  published boolean not null default false, demo boolean not null default false,
  source_id text unique, source_url text, rights_status text not null default 'pending' check(rights_status in ('pending','approved','rejected')),
  ownership_evidence text, updated_at timestamptz not null default now(), expires_at timestamptz
);
create table public.property_private_locations (
  property_id uuid primary key references properties(id) on delete cascade,
  lat double precision not null check(lat between -90 and 90),
  lng double precision not null check(lng between -180 and 180),
  exact_publication_consent boolean not null default false, consent_evidence text,
  check(not exact_publication_consent or length(consent_evidence)>0)
);
create table public.property_images (
  id uuid primary key default gen_random_uuid(), property_id uuid not null references properties(id) on delete cascade,
  url text not null check(url like 'https://%'), alt jsonb not null, credit text, source_url text,
  rights_status text not null default 'pending' check(rights_status in ('pending','approved','rejected')),
  position integer not null default 0
);
create table public.inquiries (
  id uuid primary key default gen_random_uuid(), property_id uuid not null references properties(id),
  name text not null, email text not null, country text not null, message text not null,
  idempotency_hash text unique not null, payload_hash text not null, created_at timestamptz not null default now(),
  status text not null default 'new'
);
create table public.email_outbox (
  id uuid primary key default gen_random_uuid(), inquiry_id uuid unique not null references inquiries(id),
  status text not null default 'pending' check(status in ('pending','sending','sent','failed')),
  attempts integer not null default 0, next_attempt_at timestamptz not null default now(), last_error text,
  sent_at timestamptz, locked_at timestamptz, created_at timestamptz not null default now()
);
create table public.import_jobs (
  id uuid primary key default gen_random_uuid(), created_by uuid references auth.users(id),
  source_name text not null, status text not null, rows_read integer not null, rows_written integer not null default 0, created_at timestamptz default now()
);
create table public.import_errors (
  id uuid primary key default gen_random_uuid(), job_id uuid references import_jobs(id) on delete cascade,
  row_number integer not null, field text, message text not null
);
create table public.daily_property_stats (
  day date not null, property_id uuid references properties(id), views integer not null default 0,
  inquiries integer not null default 0, primary key(day,property_id)
);
create table public.site_settings (id text primary key, value jsonb not null, updated_at timestamptz default now());
create function public.project_property_location() returns trigger language plpgsql security definer set search_path=public as $$
begin
  update properties set public_location=jsonb_build_object(
    'lat',case when new.exact_publication_consent then new.lat else round(new.lat::numeric/0.002)*0.002 end,
    'lng',case when new.exact_publication_consent then new.lng else round(new.lng::numeric/0.002)*0.002 end,
    'accuracy',case when new.exact_publication_consent then 'exact' else 'approximate' end,
    'radiusMeters',case when new.exact_publication_consent then 0 else 300 end
  ),updated_at=now() where id=new.property_id;
  return new;
end; $$;
create trigger private_location_projection after insert or update on property_private_locations for each row execute function project_property_location();
create function public.validate_property_publication() returns trigger language plpgsql set search_path=public as $$
begin
  if new.published then
    if new.rights_status<>'approved' or coalesce(new.ownership_evidence,'')='' or new.ownership='unknown' then raise exception 'Publication requires rights and ownership evidence'; end if;
    if coalesce(new.title->>'en','')='' or coalesce(new.title->>'th','')='' or coalesce(new.description->>'en','')='' or coalesce(new.description->>'th','')='' then raise exception 'Bilingual content required'; end if;
    if new.public_location is null then raise exception 'Approved public location required'; end if;
    if not exists(select 1 from property_images where property_id=new.id and rights_status='approved') then raise exception 'Approved image required'; end if;
  end if;
  new.updated_at=now(); return new;
end; $$;
create trigger publication_guard before insert or update on properties for each row execute function validate_property_publication();
create function public.submit_inquiry(p_property uuid,p_name text,p_email text,p_country text,p_message text,p_key text,p_payload text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare existing inquiries; inserted inquiries; duplicate boolean := false;
begin
  if not exists(select 1 from properties where id=p_property and published and status='available' and (expires_at is null or expires_at>now())) then raise exception 'Property unavailable'; end if;
  insert into inquiries(property_id,name,email,country,message,idempotency_hash,payload_hash)
  values(p_property,p_name,p_email,p_country,p_message,p_key,p_payload) on conflict(idempotency_hash) do nothing returning * into inserted;
  if inserted.id is null then
    select * into existing from inquiries where idempotency_hash=p_key;
    if existing.payload_hash<>p_payload then raise exception 'Idempotency conflict'; end if;
    return jsonb_build_object('id',existing.id,'duplicate',true,'emailStatus',(select status from email_outbox where inquiry_id=existing.id));
  end if;
  insert into email_outbox(inquiry_id) values(inserted.id);
  return jsonb_build_object('id',inserted.id,'duplicate',false,'emailStatus','pending');
end; $$;
revoke all on function submit_inquiry(uuid,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function submit_inquiry(uuid,text,text,text,text,text,text) to service_role;
create function public.claim_email_batch(p_limit integer default 20) returns setof email_outbox
language sql security definer set search_path=public as $$
  update email_outbox set status='sending',attempts=attempts+1,locked_at=now()
  where id in (select id from email_outbox where (status in ('pending','failed') and next_attempt_at<=now()) or (status='sending' and locked_at<now()-interval '10 minutes') order by created_at for update skip locked limit p_limit)
  returning *;
$$;
revoke all on function claim_email_batch(integer) from public,anon,authenticated;
grant execute on function claim_email_batch(integer) to service_role;
do $$ declare name text; begin
  foreach name in array array['properties','property_private_locations','property_images','inquiries','email_outbox','import_jobs','import_errors','daily_property_stats','site_settings'] loop
    execute format('alter table public.%I enable row level security',name);
    execute format('create policy admin_all on public.%I for all to authenticated using(public.is_admin()) with check(public.is_admin())',name);
  end loop;
end $$;
create policy properties_public on properties for select to anon,authenticated using(published and rights_status='approved' and (expires_at is null or expires_at>now()));
create policy property_images_public on property_images for select to anon,authenticated using(rights_status='approved' and exists(select 1 from properties p where p.id=property_id and p.published and (p.expires_at is null or p.expires_at>now())));
grant select on properties,property_images to anon,authenticated;
create view public.public_properties with(security_invoker=true) as select
  p.id,p.slug,p.title,p.description,p.transaction,p.type,p.price_thb,p.area_m2,p.land_area_m2,p.beds,p.baths,p.floor,p.built_year,
  p.ownership,p.furnishing,p.status,p.public_location,p.zone,p.province,p.amenities,p.updated_at,p.expires_at,p.demo,
  coalesce((select jsonb_agg(jsonb_build_object('url',i.url,'alt',i.alt,'credit',i.credit,'sourceUrl',i.source_url) order by i.position,i.id) from property_images i where i.property_id=p.id and i.rights_status='approved'),'[]'::jsonb) as images
from properties p where p.published and p.rights_status='approved' and (p.expires_at is null or p.expires_at>now());
grant select on public_properties to anon,authenticated;
create function public.expire_properties() returns integer language plpgsql security definer set search_path=public as $$
declare count integer; begin update properties set published=false where published and expires_at<=now(); get diagnostics count=row_count; return count; end; $$;
revoke all on function expire_properties() from public,anon,authenticated;
grant execute on function expire_properties() to service_role;

do $$ declare name text; begin
  foreach name in array array['zones','pois','events','sync_runs','source_quarantine','fx_rates','rate_windows'] loop
    execute format('alter table public.%I enable row level security', name);
    execute format('create policy admin_all on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', name);
  end loop;
end $$;
create policy zones_public on public.zones for select to anon,authenticated using(true);
create policy pois_public on public.pois for select to anon,authenticated using(published and rights_status='approved');
create policy events_public on public.events for select to anon,authenticated using(published and rights_status='approved');
create policy fx_public on public.fx_rates for select to anon,authenticated using(true);
grant select on public.zones,public.pois,public.events,public.fx_rates to anon,authenticated;
grant all on all tables in schema public to service_role;
