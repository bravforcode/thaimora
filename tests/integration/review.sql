-- Synthetic local assertions; every fixture is rolled back, never launch data.
begin;
insert into auth.users(id)values('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
insert into admin_memberships(user_id,role)values('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','admin');
insert into properties(id,slug,title,description,transaction,type,price_thb,area_m2,ownership,furnishing,zone,province,rights_status,ownership_evidence,source_url)
values('11111111-1111-1111-1111-111111111111','review-home','{"en":"Home","th":"บ้าน"}','{"en":"Description","th":"รายละเอียด"}','sale','villa',1000000,100,'freehold','furnished','Phuket','Phuket','approved','PRIVATE owner evidence','https://example.test/rights');
insert into property_private_locations(property_id,lat,lng)values('11111111-1111-1111-1111-111111111111',7.912345,98.312345);
insert into property_images(id,property_id,url,alt,rights_status,rights_evidence)values('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','https://example.test/1.jpg','{"en":"Home","th":"บ้าน"}','approved','PRIVATE image proof');
update properties set published=true where slug='review-home';
insert into pois(id,name,category,location,source,source_url,license,rights_status,published,rights_evidence)
values('review-poi','{"en":"POI","th":"สถานที่"}','restaurant','{"lat":7.92,"lng":98.32}','client','https://example.test/poi','test permission','approved',true,'PRIVATE source proof');
do $$begin
 begin update property_private_locations set exact_publication_consent=true,consent_evidence=null;raise exception 'Null consent evidence accepted';exception when check_violation then null;end;
 begin update pois set license=null where id='review-poi';raise exception 'Missing license published';exception when check_violation then null;end;
 begin update pois set demo=true where id='review-poi';raise exception 'Demo source published';exception when check_violation then null;end;
 begin update properties set demo=true where slug='review-home';raise exception 'Demo property published';exception when others then if SQLERRM='Demo property published' then raise;end if;end;
end$$;
set local role anon;
do $$begin
 if(select count(*)from public_pois)<>1 then raise exception 'Safe POI view unavailable';end if;
 if(select count(*)from nearby_content(7.912,98.312,5000))<>1 then raise exception 'Nearby rights filter failed';end if;
 begin perform rights_evidence from pois;raise exception 'POI private evidence readable';exception when insufficient_privilege then null;end;
 begin perform * from admin_audit_log;raise exception 'Audit public';exception when insufficient_privilege then null;end;
 begin perform admin_save_property(null,'{}',null,null,'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');raise exception 'Anonymous admin write';exception when insufficient_privilege then null;end;
end$$;
reset role;
set local role service_role;
do $$begin
 begin perform record_property_event('11111111-1111-1111-1111-111111111111','view',false);raise exception 'Unconsented view recorded';exception when others then if SQLERRM='Unconsented view recorded' then raise;end if;end;
 perform record_property_event('11111111-1111-1111-1111-111111111111','view',true);
 perform record_property_event('11111111-1111-1111-1111-111111111111','contact_click',true);
 if(select sum(views)from property_stats_range((now()at time zone'Asia/Bangkok')::date,(now()at time zone'Asia/Bangkok')::date))<>1 then raise exception 'Consent report missing';end if;
 begin perform admin_save_property('11111111-1111-1111-1111-111111111111','{"price_thb":2000000}',null,'[]','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');raise exception 'Invalid republish accepted';exception when others then if SQLERRM='Invalid republish accepted' then raise;end if;end;
 if(select not published or price_thb<>1000000 from properties where slug='review-home')then raise exception 'Failed write changed published property';end if;
 if(select count(*)from property_images)<>1 then raise exception 'Failed write lost gallery';end if;
 perform admin_save_property('11111111-1111-1111-1111-111111111111','{"published":false}',null,
 '[{"id":"22222222-2222-2222-2222-222222222222","url":"https://example.test/1.jpg","alt":{"en":"Home","th":"บ้าน"},"rights_status":"approved","rights_evidence":"PRIVATE image proof"},{"url":"https://example.test/2.jpg","alt":{"en":"Two","th":"สอง"},"rights_status":"approved","rights_evidence":"proof"}]','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
 if(select count(*)from property_images)<>2 then raise exception 'Gallery append failed';end if;
 perform admin_save_property('11111111-1111-1111-1111-111111111111','{"published":true}',null,
 '[{"id":"22222222-2222-2222-2222-222222222222","url":"https://example.test/1.jpg","alt":{"en":"Home","th":"บ้าน"},"rights_status":"approved","rights_evidence":"PRIVATE image proof"}]','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
 if(select count(*)from property_images)<>1 or(select min(position)from property_images)<>0 then raise exception 'Gallery delete/order failed';end if;
 if not exists(select 1 from admin_audit_log where actor_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and actor_source='validated-admin-api')then raise exception 'Admin attribution missing';end if;
 if exists(select 1 from admin_audit_log where metadata::text like '%PRIVATE%' or metadata::text like '%7.912345%')then raise exception 'Audit sensitive payload';end if;
end$$;
reset role;
delete from property_private_locations where property_id='11111111-1111-1111-1111-111111111111';
set local role anon;
do $$begin if(select count(*)from public_properties)<>0 then raise exception 'Deleted location still public';end if;end$$;
reset role;
rollback;
select 'PASS: real licensed sources, column privacy, atomic rollback/gallery reconciliation, consent statistics, private audit, location deletion' as result;
