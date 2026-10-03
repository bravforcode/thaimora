-- All fixtures remain within this rolled-back transaction, including hosted runs.
begin;
do $$
declare signatures text[]; predicates text[]; signature text; function_oid oid; owner_oid oid;
begin
 if to_regclass('public.properties') is not null then
  signatures:=array['public.project_property_location()','public.inquiry_daily_stat()','public.review_content_guard()','public.review_audit_trigger()','public.review_property_source_guard()','public.review_gallery_revocation()','public.review_private_location_delete()'];
  predicates:=array['public.is_admin()','public.is_owner()','public.content_is_public(text,text)','public.property_is_public(uuid)','public.property_image_is_public(uuid)'];
 else
  signatures:=array['public.review_content_guard()','public.review_audit_trigger()','public.review_hotel_source_guard()','public.review_gallery_revocation()','public.review_home_guard()'];
  predicates:=array['public.is_admin()','public.is_owner()','public.content_is_public(text,text)','public.hotel_is_public(uuid)','public.hotel_image_is_public(uuid)','public.public_home_settings_value()'];
 end if;
 foreach signature in array signatures loop
  function_oid:=to_regprocedure(signature);
  if function_oid is null then raise exception 'Missing trigger function %',signature;end if;
  select proowner into owner_oid from pg_proc where oid=function_oid and prosecdef and prorettype='pg_catalog.trigger'::regtype;
  if owner_oid is null then raise exception 'Unexpected trigger function definition %',signature;end if;
  if has_function_privilege('anon',function_oid,'EXECUTE') or has_function_privilege('authenticated',function_oid,'EXECUTE') then raise exception 'Client execution allowed %',signature;end if;
  if exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid=function_oid and a.grantee=0 and a.privilege_type='EXECUTE') then raise exception 'PUBLIC execution allowed %',signature;end if;
  if not has_function_privilege(owner_oid,function_oid,'EXECUTE') then raise exception 'Owner execution removed %',signature;end if;
  if not exists(select 1 from pg_trigger where tgfoid=function_oid and not tgisinternal and tgenabled<>'D') then raise exception 'Trigger attachment absent %',signature;end if;
 end loop;
 foreach signature in array predicates loop
  function_oid:=to_regprocedure(signature);
  if function_oid is null or not has_function_privilege('anon',function_oid,'EXECUTE') or not has_function_privilege('authenticated',function_oid,'EXECUTE') then raise exception 'RLS/public predicate permission removed %',signature;end if;
 end loop;
end $$;
insert into auth.users(id) values('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
insert into public.admin_memberships(user_id,role) values('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','admin');
insert into public.zones(id,slug,name,location) values('trigger-acl-zone','trigger-acl-zone','{"en":"Synthetic zone","th":"พื้นที่ทดสอบ"}','{"lat":10.09,"lng":99.83}');
insert into public.pois(id,name,category,location,source,source_url,license,rights_status,published)
values('trigger-acl-poi','{"en":"Synthetic POI","th":"สถานที่ทดสอบ"}','place','{"lat":10.09,"lng":99.83}','test','https://example.test/rollback-only','Synthetic regression permission','approved',true);
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',true);
set local role authenticated;
update public.pois set name='{"en":"Edited synthetic POI","th":"แก้ไขสถานที่ทดสอบ"}' where id='trigger-acl-poi';
update public.zones set description='{"en":"Edited synthetic zone","th":"แก้ไขพื้นที่ทดสอบ"}' where id='trigger-acl-zone';
do $$begin
 if not exists(select 1 from public.admin_audit_log where record_id='trigger-acl-poi' and operation='UPDATE' and actor_id=auth.uid() and actor_source='database-trigger') then raise exception 'Authenticated POI audit trigger failed';end if;
 if not exists(select 1 from public.admin_audit_log where record_id='trigger-acl-zone' and operation='UPDATE' and actor_id=auth.uid() and actor_source='database-trigger') then raise exception 'Authenticated zone audit trigger failed';end if;
 begin update public.pois set license=null where id='trigger-acl-poi';raise exception 'Invalid published license accepted';exception when check_violation then null;end;
end $$;
reset role;
rollback;
select 'PASS: internal trigger ACLs, public RLS predicates, authenticated admin DML/audit/license guards' as result;
