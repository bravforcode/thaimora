-- All dependent admin edits succeed or roll back together.
begin;
-- CHECK expressions must reject NULL evidence as well as empty strings.
update public.property_private_locations set exact_publication_consent=false where exact_publication_consent and coalesce(length(btrim(consent_evidence)),0)=0;
alter table public.property_private_locations add constraint consent_documented check(not exact_publication_consent or coalesce(length(btrim(consent_evidence)),0)>0);
create function public.admin_save_property(p_id uuid,p_fields jsonb,p_private jsonb,p_images jsonb,p_actor uuid)
 returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare prior public.properties; payload jsonb; private_row jsonb; cols text; target uuid; publish boolean; result jsonb;
begin
 if not exists(select 1 from public.admin_memberships where user_id=p_actor) then raise exception 'Admin required';end if;
 if jsonb_typeof(p_fields) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_fields) k where k not in(
 'slug','title','description','transaction','type','price_thb','area_m2','land_area_m2','beds','baths','floor','built_year','ownership','furnishing','status','zone','province','amenities','published','demo','source_id','source_url','rights_status','ownership_evidence','expires_at')) then raise exception 'Invalid property fields';end if;
 if p_id is not null then
  select * into prior from public.properties where id=p_id for update;
  if not found then raise exception 'Property not found';end if;
 end if;
 target:=coalesce(p_id,gen_random_uuid());publish:=coalesce((p_fields->>'published')::boolean,prior.published,false);
 payload:=p_fields||jsonb_build_object('id',target,'published',false);
 select string_agg(quote_ident(k),',' order by k) into cols from jsonb_object_keys(payload) k;
 if p_id is null then
  execute format('insert into public.properties(%1$s) select %1$s from jsonb_populate_record(null::public.properties,$1)',cols) using payload;
 else
  execute format('update public.properties set (%1$s)=(select %1$s from jsonb_populate_record(null::public.properties,$1)) where id=$2',cols) using payload,target;
 end if;
 if p_private is not null then
  if jsonb_typeof(p_private) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_private) k where k not in('lat','lng','exact_publication_consent','consent_evidence')) then raise exception 'Invalid private location fields';end if;
  select to_jsonb(p) into private_row from public.property_private_locations p where property_id=target;
  private_row:=coalesce(private_row,jsonb_build_object('exact_publication_consent',false))||p_private;
  insert into public.property_private_locations(property_id,lat,lng,exact_publication_consent,consent_evidence)
  values(target,(private_row->>'lat')::float,(private_row->>'lng')::float,coalesce((private_row->>'exact_publication_consent')::boolean,false),private_row->>'consent_evidence')
  on conflict(property_id) do update set lat=excluded.lat,lng=excluded.lng,exact_publication_consent=excluded.exact_publication_consent,consent_evidence=excluded.consent_evidence;
 end if;
 if p_images is not null then perform public.reconcile_property_gallery(target,p_images);end if;
 if publish then update public.properties set published=true where id=target;end if;
 perform public.record_admin_audit(p_actor,'properties',target::text,case when p_id is null then 'INSERT' else 'UPDATE' end,
 array(select jsonb_object_keys(p_fields))||case when p_private is null then array[]::text[] else array['private_location'] end||case when p_images is null then array[]::text[] else array['images'] end);
 select to_jsonb(p) into result from public.properties p where id=target;return result;
end;$$;
revoke all on function public.admin_save_property(uuid,jsonb,jsonb,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.admin_save_property(uuid,jsonb,jsonb,jsonb,uuid) to service_role;
create function public.review_image_owner_guard() returns trigger language plpgsql set search_path=pg_catalog as $$
begin if new.property_id is distinct from old.property_id then raise exception 'Image ownership is immutable';end if;return new;end;$$;
create trigger review_image_owner_guard before update on public.property_images for each row execute function public.review_image_owner_guard();
-- Private evidence stays available through the authenticated admin API only.
revoke select on public.properties,public.property_images,public.pois,public.events from anon,authenticated;
grant select(id,slug,title,description,transaction,type,price_thb,area_m2,land_area_m2,beds,baths,floor,built_year,ownership,furnishing,status,public_location,zone,province,amenities,published,demo,rights_status,updated_at,expires_at) on public.properties to anon,authenticated;
grant select(id,property_id,url,alt,credit,source_url,rights_status,position) on public.property_images to anon,authenticated;
grant select(source_url) on public.properties to anon,authenticated;
create or replace view public.public_properties with(security_invoker=true) as select
 p.id,p.slug,p.title,p.description,p.transaction,p.type,p.price_thb,p.area_m2,p.land_area_m2,p.beds,p.baths,p.floor,p.built_year,p.ownership,p.furnishing,p.status,p.public_location,p.zone,p.province,p.amenities,p.updated_at,p.expires_at,p.demo,
 coalesce((select jsonb_agg(jsonb_build_object('url',i.url,'alt',i.alt,'credit',i.credit,'sourceUrl',i.source_url) order by i.position,i.id)
 from public.property_images i where i.property_id=p.id and public.property_image_is_public(i.id)),'[]'::jsonb) images,p.source_url
 from public.properties p where public.property_is_public(p.id);
grant select(id,name,description,category,location,zone_id,image,source_url,website,demo,source,license,fetched_at,source_updated_at,published,rights_status) on public.pois to anon,authenticated;
grant select(id,name,description,starts_at,ends_at,location,zone_id,image,source_url,demo,source,license,fetched_at,source_updated_at,published,rights_status) on public.events to anon,authenticated;
create function public.review_private_location_delete() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin update public.properties set published=false,public_location=null where id=old.property_id;return old;end;$$;
create trigger review_private_location_delete after delete on public.property_private_locations for each row execute function public.review_private_location_delete();
commit;
