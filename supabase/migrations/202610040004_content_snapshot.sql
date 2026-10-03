-- One stable database statement keeps public data and revision coherent.
-- Aggregate rows bypass PostgREST's per-result row limit without removing the catalog ceiling.
begin;
create function public.public_content_snapshot(p_scope text default 'full') returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare pois jsonb;events jsonb;result jsonb;home jsonb;begin
 if p_scope is null or p_scope not in ('full','events') then raise exception 'Invalid public content scope';end if;
 select coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]'::jsonb) into events
 from (select * from public.public_events order by id limit 10001) e;
 if jsonb_array_length(events)>10000 then raise exception 'Public event catalog limit exceeded';end if;
 result:=jsonb_build_object('events',events,'meta',public.public_content_meta());
 if p_scope='full' then
  select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]'::jsonb) into pois
  from (select * from public.public_pois order by id limit 10001) p;
  if jsonb_array_length(pois)>10000 then raise exception 'Public place catalog limit exceeded';end if;
  result:=result||jsonb_build_object('pois',pois);
  if to_regprocedure('public.public_home_settings_value()') is not null then
   -- This existing public function whitelists heading/sections/zones and checks
   -- every featured hotel against publication rights within the same snapshot.
   execute 'select public.public_home_settings_value()' into home;
   result:=result||jsonb_build_object('homeSettings',home);
  end if;
 end if;
 return result;
end;$$;
revoke all on function public.public_content_snapshot(text) from public;
grant execute on function public.public_content_snapshot(text) to anon,authenticated,service_role;
commit;
