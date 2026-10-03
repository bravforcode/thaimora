begin;
insert into properties(id,slug,title,description,transaction,type,price_thb,area_m2,ownership,furnishing,zone,province,rights_status,ownership_evidence,amenities,demo)
-- Synthetic rows exist only inside this rolled-back disposable SQL transaction.
-- demo=false exercises the real-public eligibility path; it is not launch data.
select md5('pagination-'||i)::uuid,'sql-pagination-'||i,'{"en":"Pagination fixture","th":"ทดสอบแบ่งหน้า"}','{"en":"Test only","th":"ข้อมูลทดสอบ"}','sale','villa',1000000,100,'freehold','furnished','Phuket','Phuket','approved','SQL test proof',array['pool'],false from generate_series(1,500)i;
insert into property_private_locations(property_id,lat,lng)
select id,7.91,98.31 from properties where slug like 'sql-pagination-%';
insert into property_images(property_id,url,alt,rights_status,rights_evidence)
select id,'https://example.test/fixture.jpg','{"en":"Fixture","th":"ทดสอบ"}','approved','SQL test rights' from properties where slug like 'sql-pagination-%';
update properties set source_url='https://example.test/authorized-rollback-test',published=true where slug like 'sql-pagination-%';
set local role anon;
do $$
declare page record;cursor_json jsonb:=null;seen uuid[]:='{}';n integer;pages integer:=0;args jsonb;
begin
 loop
  args:=jsonb_build_object('sort','price_asc','limit',50,'q','Pagination','ownership','freehold','furnishing','furnished','amenities',jsonb_build_array('pool'));
  if cursor_json is not null then args:=args||jsonb_build_object('cursor',cursor_json);end if;
  n:=0;
  for page in select * from search_properties_v2(args) loop
   if(page.row_data->>'id')::uuid=any(seen)then raise exception 'Cursor duplicate';end if;
   seen:=array_append(seen,(page.row_data->>'id')::uuid);
   cursor_json:=jsonb_build_object('sort','price_asc','id',page.row_data->>'id','value',page.sort_value);
   n:=n+1;
  end loop;
  pages:=pages+1;if pages>12 then raise exception 'Cursor loop';end if;
  exit when n=0;
 end loop;
 if cardinality(seen)<>500 then raise exception 'Expected all 500 rows, got %',cardinality(seen);end if;
 if(select count(*)from search_properties_v2('{"sort":"relevance","q":"Pagination","limit":50}'::jsonb))<>50 then raise exception 'Relevance query failed';end if;
 if(select count(*)from search_properties_v2('{"sort":"distance","center":[98.33,7.94],"q":"Pagination","limit":50}'::jsonb))<>50 then raise exception 'Distance query failed';end if;
 if(select count(*)from search_properties_v2('{"sort":"newest","q":"Pagination","furnishing":"unfurnished","limit":50}'::jsonb))<>0 then raise exception 'Furnishing filter failed';end if;
end $$;
reset role;
rollback;
select 'PASS: 500 synthetic SQL fixtures fully traversed without skipped/duplicate cursors; text/ownership/furnishing/amenities/relevance/distance filters' as result;
