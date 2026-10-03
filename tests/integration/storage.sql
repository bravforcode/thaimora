-- Tests modeled Storage RLS and migration scrubbing; actual hosted object-info UAT remains required.
begin;
do $$begin
 if exists(select 1 from storage.objects where bucket_id='property-images' and user_metadata ? 'rights_evidence')then
   raise exception 'Private evidence retained in public object metadata';
 end if;
 if (select user_metadata from storage.objects where name='legacy.jpg') is distinct from '{"sanitized":true,"rights_confirmed":true}'::jsonb then
   raise exception 'Legacy metadata was not scrubbed to safe flags';
 end if;
 if (select metadata->>'mimetype' from storage.objects where name='legacy.jpg') is distinct from 'image/jpeg' then
   raise exception 'Internal content metadata changed';
 end if;
 if (select original_user_metadata from private.property_image_metadata_archive where object_name='legacy.jpg')
     is distinct from '{"sanitized":true,"rights_evidence":"https://rights.example.test/private-proof","private_note":"private owner data"}'::jsonb then
   raise exception 'Exact legacy proof was not preserved privately';
 end if;
end $$;
set local role anon;
do $$begin
 begin
  perform original_user_metadata from private.property_image_metadata_archive;
  raise exception 'Anonymous role could read private archive';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
insert into auth.users(id) values('11111111-1111-4111-8111-111111111120');
insert into public.admin_memberships(user_id,role) values('11111111-1111-4111-8111-111111111120','admin');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111120',true);
do $$begin
 begin
  perform original_user_metadata from private.property_image_metadata_archive;
  raise exception 'Client staff token could read private archive';
 exception when insufficient_privilege then null;
 end;
end $$;
insert into storage.objects(bucket_id,name,user_metadata) values('property-images','safe.jpg','{"sanitized":true,"rights_confirmed":true}');
do $$begin
 begin
  insert into storage.objects(bucket_id,name,user_metadata) values('property-images','bad.jpg','{"sanitized":true,"rights_confirmed":true,"rights_evidence":"https://rights.example.test/private"}');
  raise exception 'Unsafe metadata INSERT accepted';
 exception when insufficient_privilege then null;
 end;
 begin
  update storage.objects set user_metadata='{"sanitized":true,"rights_confirmed":true,"private_note":"owner"}' where name='safe.jpg';
  raise exception 'Unsafe metadata UPDATE accepted';
 exception when insufficient_privilege then null;
 end;
end $$;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111121',true);
do $$begin
 begin
  insert into storage.objects(bucket_id,name,user_metadata) values('property-images','nonstaff.jpg','{"sanitized":true,"rights_confirmed":true}');
  raise exception 'Nonstaff upload accepted';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
rollback;
