-- Independent review corrections; source/rights checks remain server-enforced.
begin;
alter table public.pois add column if not exists rights_evidence text;
alter table public.events add column if not exists rights_evidence text;
create function public.review_licensed_content(r jsonb) returns boolean language sql immutable set search_path=pg_catalog as $$
 select coalesce(r->>'rights_status'='approved',false) and coalesce(r->>'demo'='false',false)
 and length(btrim(coalesce(r->>'source','')))>0
 and coalesce(r->>'source_url','') ~ '^https://[^[:space:]]+$'
 and length(btrim(coalesce(r->>'license','')))>0;
$$;
create function public.review_content_guard() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if new.published and not public.review_licensed_content(to_jsonb(new)) then
  raise exception 'Published content requires a real source, HTTPS source URL, license and approved rights' using errcode='23514';
 end if;
 return new;
end;$$;
create trigger review_content_guard before insert or update on public.pois for each row execute function public.review_content_guard();
create trigger review_content_guard before insert or update on public.events for each row execute function public.review_content_guard();
create function public.content_is_public(p_table text,p_id text) returns boolean language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare r jsonb;begin
 if p_table='pois' then select to_jsonb(t) into r from public.pois t where id=p_id;
 elsif p_table='events' then select to_jsonb(t) into r from public.events t where id=p_id;
 else return false;end if;
 return coalesce((r->>'published')::boolean,false) and public.review_licensed_content(r);
end;$$;
revoke all on function public.content_is_public(text,text) from public;
grant execute on function public.content_is_public(text,text) to anon,authenticated,service_role;
update public.pois set published=false where published and not public.content_is_public('pois',id);
update public.events set published=false where published and not public.content_is_public('events',id);
drop policy pois_public on public.pois;
create policy pois_public on public.pois for select to anon,authenticated using(public.content_is_public('pois',id));
drop policy events_public on public.events;
create policy events_public on public.events for select to anon,authenticated using(public.content_is_public('events',id));
create view public.public_pois with(security_invoker=true) as
 select id,name,description,category,location,zone_id,image,source_url,website,demo,source,license,fetched_at,source_updated_at
 from public.pois where public.content_is_public('pois',id);
create view public.public_events with(security_invoker=true) as
 select id,name,description,starts_at,ends_at,location,zone_id,image,source_url,demo,source,license,fetched_at,source_updated_at
 from public.events where public.content_is_public('events',id);
grant select(source,license,fetched_at,source_updated_at) on public.pois,public.events to anon,authenticated;
grant select on public.public_pois,public.public_events to anon,authenticated,service_role;
create table public.admin_audit_log(
 id bigint generated always as identity primary key,occurred_at timestamptz not null default now(),
 actor_id uuid,actor_kind text not null,actor_source text not null,table_name text not null,record_id text not null,
 operation text not null,metadata jsonb not null default '{}'::jsonb
);
alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from public,anon,authenticated;
grant select on public.admin_audit_log to authenticated;
create policy audit_admin_read on public.admin_audit_log for select to authenticated using(public.is_admin());
grant select,insert on public.admin_audit_log to service_role;
grant usage,select on sequence public.admin_audit_log_id_seq to service_role;
create index admin_audit_resource on public.admin_audit_log(table_name,record_id,occurred_at desc);
create function public.review_audit_fields(fields text[]) returns jsonb language sql immutable set search_path=pg_catalog as $$
 select coalesce(jsonb_agg(f order by f),'[]'::jsonb) from(
 select distinct f from unnest(coalesce(fields,array[]::text[])) f where f=any(array[
 'slug','title','name','description','transaction','type','price_thb','area_m2','land_area_m2','beds','baths','floor','built_year','ownership','furnishing','status','zone','zone_id','province','amenities','expires_at','published','demo','rights_status','source','source_url','license','images','position','url','alt','credit','category','website','starts_at','ends_at','geometry','role','provider','provider_hotel_id','review_score','review_scale','stars','beachfront','pier_distance_km','enabled','affiliate_id','value'
 ]::text[])) s;
$$;
create function public.review_audit_trigger() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare old_row jsonb;new_row jsonb;r jsonb;fields text[];actor uuid;rid text;
begin
 if tg_op<>'INSERT' then old_row:=to_jsonb(old);end if;
 if tg_op<>'DELETE' then new_row:=to_jsonb(new);end if;
 r:=coalesce(new_row,old_row);rid:=coalesce(r->>'id',r->>'property_id',r->>'hotel_id',r->>'user_id','unknown');
 select array_agg(k) into fields from jsonb_object_keys(r) k where tg_op<>'UPDATE' or old_row->k is distinct from new_row->k;
 actor:=auth.uid();
 insert into public.admin_audit_log(actor_id,actor_kind,actor_source,table_name,record_id,operation,metadata)
 values(actor,case when actor is null then 'service-system' else 'authenticated-db-user' end,'database-trigger',tg_table_name,rid,tg_op,
 jsonb_build_object('fields',public.review_audit_fields(fields),'privateLocationChanged',tg_table_name='property_private_locations','permissionChanged',tg_table_name='admin_memberships' or coalesce(fields&&array['rights_status','rights_evidence','exact_publication_consent','consent_evidence'],false)));
 if tg_op='DELETE' then return old;else return new;end if;
end;$$;
create function public.record_admin_audit(p_actor uuid,p_table text,p_id text,p_operation text,p_fields text[]) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if not exists(select 1 from public.admin_memberships where user_id=p_actor) or p_id is null or length(p_id)>200
 or p_table<>all(array['properties','property_images','property_private_locations','hotels','hotel_images','hotel_provider_ids','hotel_amenities','hotel_content','pois','events','zones','admin_memberships','provider_settings','site_settings']::text[])
 or upper(p_operation)<>all(array['INSERT','UPDATE','DELETE']::text[]) then raise exception 'Invalid admin audit context';end if;
 insert into public.admin_audit_log(actor_id,actor_kind,actor_source,table_name,record_id,operation,metadata)
 values(p_actor,'authenticated-admin','validated-admin-api',p_table,p_id,'ADMIN_ACTION',
 jsonb_build_object('operation',upper(p_operation),'fields',public.review_audit_fields(p_fields),'privateLocationChanged',coalesce(p_fields&&array['private_location','privateLocation'],false),'permissionChanged',coalesce(p_fields&&array['rights_status','published','exact_publication_consent'],false)));
end;$$;
revoke all on function public.record_admin_audit(uuid,text,text,text,text[]) from public,anon,authenticated;
grant execute on function public.record_admin_audit(uuid,text,text,text,text[]) to service_role;
alter table public.daily_property_stats add column contact_clicks integer not null default 0 check(contact_clicks>=0);
create function public.review_image_licensed(r jsonb) returns boolean language sql immutable set search_path=pg_catalog as $$
 select coalesce(r->>'rights_status'='approved',false) and coalesce(r->>'url','') ~ '^https://[^[:space:]]+$'
 and length(btrim(coalesce(r->>'rights_evidence','')))>0;
$$;
create function public.property_is_public(pid uuid) returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select coalesce((select p.published and not p.demo and p.rights_status='approved' and coalesce(p.source_url,'') ~ '^https://[^[:space:]]+$'
 and p.ownership<>'unknown' and length(btrim(coalesce(p.ownership_evidence,'')))>0 and (p.expires_at is null or p.expires_at>now())
 and exists(select 1 from public.property_images i where i.property_id=p.id and public.review_image_licensed(to_jsonb(i)))
 from public.properties p where p.id=pid),false);
$$;
revoke all on function public.property_is_public(uuid) from public;
grant execute on function public.property_is_public(uuid) to anon,authenticated,service_role;
create function public.property_image_is_public(iid uuid) returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select coalesce((select public.review_image_licensed(to_jsonb(i)) and public.property_is_public(i.property_id) from public.property_images i where i.id=iid),false);
$$;
revoke all on function public.property_image_is_public(uuid) from public;
grant execute on function public.property_image_is_public(uuid) to anon,authenticated,service_role;
create function public.review_property_source_guard() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if new.published and (new.demo or coalesce(new.source_url,'') !~ '^https://[^[:space:]]+$') then raise exception 'Published property requires an authorized real HTTPS source';end if;
 return new;
end;$$;
create trigger review_property_source_guard before insert or update on public.properties for each row execute function public.review_property_source_guard();
update public.properties set published=false where published and not public.property_is_public(id);
drop policy properties_public on public.properties;
create policy properties_public on public.properties for select to anon,authenticated using(public.property_is_public(id));
drop policy property_images_public on public.property_images;
create policy property_images_public on public.property_images for select to anon,authenticated using(public.property_image_is_public(id));
create or replace view public.public_properties with(security_invoker=true) as select
 p.id,p.slug,p.title,p.description,p.transaction,p.type,p.price_thb,p.area_m2,p.land_area_m2,p.beds,p.baths,p.floor,p.built_year,p.ownership,p.furnishing,p.status,p.public_location,p.zone,p.province,p.amenities,p.updated_at,p.expires_at,p.demo,
 coalesce((select jsonb_agg(jsonb_build_object('url',i.url,'alt',i.alt,'credit',i.credit,'sourceUrl',i.source_url) order by i.position,i.id)
 from public.property_images i where i.property_id=p.id and public.property_image_is_public(i.id)),'[]'::jsonb) images
 from public.properties p where public.property_is_public(p.id);
create function public.reconcile_property_gallery(p_property uuid,p_images jsonb) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare r jsonb;ord bigint;img uuid;ids uuid[]:=array[]::uuid[];is_published boolean;
begin
 select published into is_published from public.properties where id=p_property for update;
 if not found or is_published then raise exception 'Existing draft property required';end if;
 if p_images is null or jsonb_typeof(p_images)<>'array' or jsonb_array_length(p_images)>30 then raise exception 'Invalid gallery';end if;
 for r,ord in select value,ordinality from jsonb_array_elements(p_images) with ordinality loop
  img:=coalesce(nullif(r->>'id','')::uuid,gen_random_uuid());
  if img=any(ids) or exists(select 1 from public.property_images where id=img and property_id<>p_property) then raise exception 'Duplicate or foreign image ID';end if;
  if coalesce(r->>'rights_status','pending')='approved' and not public.review_image_licensed(r) then raise exception 'Approved image requires documented rights';end if;
  ids:=array_append(ids,img);
  insert into public.property_images(id,property_id,url,alt,credit,source_url,rights_status,rights_evidence,position)
  values(img,p_property,r->>'url',coalesce(r->'alt','{}'::jsonb),r->>'credit',r->>'source_url',coalesce(r->>'rights_status','pending'),r->>'rights_evidence',ord-1)
  on conflict(id) do update set url=excluded.url,alt=excluded.alt,credit=excluded.credit,source_url=excluded.source_url,rights_status=excluded.rights_status,rights_evidence=excluded.rights_evidence,position=excluded.position;
 end loop;
 delete from public.property_images where property_id=p_property and not(id=any(ids));
end;$$;
revoke all on function public.reconcile_property_gallery(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.reconcile_property_gallery(uuid,jsonb) to service_role;
create function public.review_gallery_revocation() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare pid uuid;begin
 if tg_op='DELETE' then pid:=old.property_id;else pid:=new.property_id;end if;
 if not public.property_is_public(pid) then update public.properties set published=false where id=pid and published;end if;
 if tg_op='DELETE' then return old;else return new;end if;
end;$$;
create trigger review_gallery_revocation after insert or update or delete on public.property_images for each row execute function public.review_gallery_revocation();
drop function public.record_property_view(uuid);
create function public.record_property_event(p_property uuid,p_kind text,p_consented boolean) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if p_consented is distinct from true or p_kind not in('view','contact_click') or p_kind is null then raise exception 'Explicit measurement consent required';end if;
 if not public.property_is_public(p_property) then raise exception 'Property unavailable';end if;
 insert into public.daily_property_stats(day,property_id,views,contact_clicks)
 values((now() at time zone 'Asia/Bangkok')::date,p_property,(p_kind='view')::integer,(p_kind='contact_click')::integer)
 on conflict(day,property_id) do update set views=daily_property_stats.views+excluded.views,contact_clicks=daily_property_stats.contact_clicks+excluded.contact_clicks;
end;$$;
revoke all on function public.record_property_event(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.record_property_event(uuid,text,boolean) to service_role;
create or replace function public.inquiry_daily_stat() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 insert into public.daily_property_stats(day,property_id,inquiries) values((new.created_at at time zone 'Asia/Bangkok')::date,new.property_id,1)
 on conflict(day,property_id) do update set inquiries=daily_property_stats.inquiries+1;return new;
end;$$;
create function public.property_stats_range(p_from date,p_to date) returns table(day date,property_id uuid,views bigint,inquiries bigint,contact_clicks bigint)
 language plpgsql stable security definer set search_path=pg_catalog,public as $$
begin
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>365 then raise exception 'Invalid report range';end if;
 return query select s.day,null::uuid,sum(s.views)::bigint,sum(s.inquiries)::bigint,sum(s.contact_clicks)::bigint from public.daily_property_stats s where s.day between p_from and p_to group by s.day order by s.day;
end;$$;
revoke all on function public.property_stats_range(date,date) from public,anon,authenticated;
grant execute on function public.property_stats_range(date,date) to service_role;
do $$declare t text;begin foreach t in array array['properties','property_images','property_private_locations','pois','events','zones','admin_memberships','site_settings'] loop
 execute format('create trigger review_audit after insert or update or delete on public.%I for each row execute function public.review_audit_trigger()',t);
end loop;end$$;
create or replace function public.nearby_content(p_lat float,p_lng float,p_radius integer default 5000)
 returns table(id text,name jsonb,category text,location jsonb,source_url text,distance_meters float)
 language sql stable set search_path=public,extensions as $$
 select id,name,category,location,source_url,ST_Distance(ST_SetSRID(ST_MakePoint((location->>'lng')::float,(location->>'lat')::float),4326)::geography,ST_SetSRID(ST_MakePoint(p_lng,p_lat),4326)::geography)
 from public.public_pois where ST_DWithin(ST_SetSRID(ST_MakePoint((location->>'lng')::float,(location->>'lat')::float),4326)::geography,ST_SetSRID(ST_MakePoint(p_lng,p_lat),4326)::geography,least(greatest(p_radius,0),20000))
 order by 6 limit 100;$$;
commit;
