create function public.search_properties(p_filters jsonb) returns setof public_properties
language plpgsql stable set search_path=public,extensions as $$
declare sort_key text; sort_dir text; filter_sql text; begin
  sort_key:=case p_filters->>'sort' when 'price_asc' then 'price_thb' when 'price_desc' then 'price_thb' when 'area_desc' then 'area_m2' else 'updated_at' end;
  sort_dir:=case p_filters->>'sort' when 'price_asc' then 'asc' else 'desc' end;
  filter_sql:=' where true';
  if p_filters->>'transaction' is not null then filter_sql:=filter_sql||format(' and transaction=%L',p_filters->>'transaction');end if;
  if p_filters->>'type' is not null then filter_sql:=filter_sql||format(' and type=%L',p_filters->>'type');end if;
  if p_filters->>'status' is not null then filter_sql:=filter_sql||format(' and status=%L',p_filters->>'status');end if;
  if p_filters->>'zone' is not null then filter_sql:=filter_sql||format(' and zone=%L',p_filters->>'zone');end if;
  if p_filters->>'province' is not null then filter_sql:=filter_sql||format(' and province=%L',p_filters->>'province');end if;
  if p_filters->>'minPrice' is not null then filter_sql:=filter_sql||format(' and price_thb>=%L::numeric',p_filters->>'minPrice');end if;
  if p_filters->>'maxPrice' is not null then filter_sql:=filter_sql||format(' and price_thb<=%L::numeric',p_filters->>'maxPrice');end if;
  if p_filters->>'minArea' is not null then filter_sql:=filter_sql||format(' and area_m2>=%L::numeric',p_filters->>'minArea');end if;
  if p_filters->>'maxArea' is not null then filter_sql:=filter_sql||format(' and area_m2<=%L::numeric',p_filters->>'maxArea');end if;
  if p_filters->>'beds' is not null then filter_sql:=filter_sql||format(' and beds>=%L::integer',p_filters->>'beds');end if;
  if p_filters->>'baths' is not null then filter_sql:=filter_sql||format(' and baths>=%L::integer',p_filters->>'baths');end if;
  if p_filters->'bbox' is not null then filter_sql:=filter_sql||format(' and ST_Intersects(ST_SetSRID(ST_MakePoint((public_location->>''lng'')::float,(public_location->>''lat'')::float),4326),ST_MakeEnvelope(%L::float,%L::float,%L::float,%L::float,4326))',p_filters->'bbox'->>0,p_filters->'bbox'->>1,p_filters->'bbox'->>2,p_filters->'bbox'->>3);end if;
  if p_filters->'polygon' is not null then filter_sql:=filter_sql||format(' and ST_Intersects(ST_SetSRID(ST_MakePoint((public_location->>''lng'')::float,(public_location->>''lat'')::float),4326),ST_SetSRID(ST_GeomFromGeoJSON(%L),4326))',p_filters->'polygon');end if;
  if p_filters->'cursor' is not null then filter_sql:=filter_sql||format(' and (%I,id) %s (%L::%s,%L::uuid)',sort_key,case when sort_dir='asc' then '>' else '<' end,p_filters->'cursor'->>'value',case when sort_key='updated_at' then 'timestamptz' else 'numeric' end,p_filters->'cursor'->>'id');end if;
  return query execute 'select * from public_properties'||filter_sql||format(' order by %I %s,id %s limit %s',sort_key,sort_dir,sort_dir,least(greatest(coalesce((p_filters->>'limit')::integer,30),1),51));
end; $$;
create function public.nearby_content(p_lat float,p_lng float,p_radius integer default 5000)
returns table(id text,name jsonb,category text,location jsonb,source_url text,distance_meters float)
language sql stable set search_path=public,extensions as $$
select id,name,category,location,source_url,ST_Distance(ST_SetSRID(ST_MakePoint((location->>'lng')::float,(location->>'lat')::float),4326)::geography,ST_SetSRID(ST_MakePoint(p_lng,p_lat),4326)::geography)
from pois where published and rights_status='approved' and ST_DWithin(ST_SetSRID(ST_MakePoint((location->>'lng')::float,(location->>'lat')::float),4326)::geography,ST_SetSRID(ST_MakePoint(p_lng,p_lat),4326)::geography,least(p_radius,20000))
order by 6 limit 100; $$;
grant execute on function nearby_content(float,float,integer) to anon,authenticated,service_role;
