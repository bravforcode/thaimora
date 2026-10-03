create function public.search_properties_v2(p_filters jsonb) returns table(row_data jsonb,sort_value text)
language plpgsql stable set search_path=public,extensions as $$
declare expr text; direction text; value_type text; where_sql text:=' where true'; search_text text; begin
 direction:=case p_filters->>'sort' when 'price_asc' then 'asc' when 'distance' then 'asc' else 'desc' end;
 expr:=case p_filters->>'sort' when 'price_asc' then 'p.price_thb' when 'price_desc' then 'p.price_thb' when 'area_desc' then 'p.area_m2' else 'p.updated_at' end;
 value_type:=case when expr='p.updated_at' then 'timestamptz' else 'numeric' end;
 if p_filters->>'sort'='distance' then
  expr:=format('ST_Distance(ST_SetSRID(ST_MakePoint((p.public_location->>''lng'')::float,(p.public_location->>''lat'')::float),4326)::geography,ST_SetSRID(ST_MakePoint(%L::float,%L::float),4326)::geography)',p_filters->'center'->>0,p_filters->'center'->>1);value_type:='float';
 end if;
 search_text:=p_filters->>'q';
 if search_text is not null then
  where_sql:=where_sql||format(' and position(lower(%L) in lower(concat_ws('' '',p.title->>''en'',p.title->>''th'',p.description->>''en'',p.description->>''th'',p.zone,p.province,array_to_string(p.amenities,'' ''))))>0',search_text);
  if p_filters->>'sort'='relevance' then
   expr:=format('(case when position(lower(%L) in lower(concat_ws('' '',p.title->>''en'',p.title->>''th'')))>0 then 3 when position(lower(%L) in lower(p.zone))>0 then 2 else 1 end)',search_text,search_text);value_type:='integer';
  end if;
 end if;
 if p_filters->>'transaction' is not null then where_sql:=where_sql||format(' and p.transaction=%L',p_filters->>'transaction');end if;
 if p_filters->>'type' is not null then where_sql:=where_sql||format(' and p.type=%L',p_filters->>'type');end if;
 if p_filters->>'status' is not null then where_sql:=where_sql||format(' and p.status=%L',p_filters->>'status');end if;
 if p_filters->>'ownership' is not null then where_sql:=where_sql||format(' and p.ownership=%L',p_filters->>'ownership');end if;
 if p_filters->>'furnishing' is not null then where_sql:=where_sql||format(' and p.furnishing=%L',p_filters->>'furnishing');end if;
 if p_filters->>'zone' is not null then where_sql:=where_sql||format(' and p.zone=%L',p_filters->>'zone');end if;
 if p_filters->>'province' is not null then where_sql:=where_sql||format(' and p.province=%L',p_filters->>'province');end if;
 if p_filters->'amenities' is not null then where_sql:=where_sql||format(' and p.amenities @> array(select jsonb_array_elements_text(%L::jsonb))',p_filters->'amenities');end if;
 if p_filters->>'minPrice' is not null then where_sql:=where_sql||format(' and p.price_thb>=%L::numeric',p_filters->>'minPrice');end if;
 if p_filters->>'maxPrice' is not null then where_sql:=where_sql||format(' and p.price_thb<=%L::numeric',p_filters->>'maxPrice');end if;
 if p_filters->>'minArea' is not null then where_sql:=where_sql||format(' and p.area_m2>=%L::numeric',p_filters->>'minArea');end if;
 if p_filters->>'maxArea' is not null then where_sql:=where_sql||format(' and p.area_m2<=%L::numeric',p_filters->>'maxArea');end if;
 if p_filters->>'beds' is not null then where_sql:=where_sql||format(' and p.beds>=%L::integer',p_filters->>'beds');end if;
 if p_filters->>'baths' is not null then where_sql:=where_sql||format(' and p.baths>=%L::integer',p_filters->>'baths');end if;
 if p_filters->'bbox' is not null then where_sql:=where_sql||format(' and ST_Intersects(ST_SetSRID(ST_MakePoint((p.public_location->>''lng'')::float,(p.public_location->>''lat'')::float),4326),ST_MakeEnvelope(%L::float,%L::float,%L::float,%L::float,4326))',p_filters->'bbox'->>0,p_filters->'bbox'->>1,p_filters->'bbox'->>2,p_filters->'bbox'->>3);end if;
 if p_filters->'polygon' is not null then where_sql:=where_sql||format(' and ST_Intersects(ST_SetSRID(ST_MakePoint((p.public_location->>''lng'')::float,(p.public_location->>''lat'')::float),4326),ST_SetSRID(ST_GeomFromGeoJSON(%L),4326))',p_filters->'polygon');end if;
 if p_filters->'cursor' is not null then where_sql:=where_sql||format(' and (%s,p.id) %s (%L::%s,%L::uuid)',expr,case when direction='asc' then '>' else '<' end,p_filters->'cursor'->>'value',value_type,p_filters->'cursor'->>'id');end if;
 return query execute format('select to_jsonb(p),(%s)::text from public_properties p%s order by %s %s,p.id %s limit %s',expr,where_sql,expr,direction,direction,least(greatest(coalesce((p_filters->>'limit')::integer,30),1),51));
end; $$;
grant execute on function search_properties_v2(jsonb) to anon,authenticated,service_role;
