-- Only synthetic recovery: verifies archived private evidence and its actual restored grants.
begin;
do $$begin
 if (select original_user_metadata->>'rights_evidence' from private.property_image_metadata_archive where object_name='legacy.jpg')
   is distinct from 'https://rights.example.test/private-proof' then
  raise exception 'Private image proof did not survive encrypted recovery';
 end if;
end $$;
set local role anon;
do $$begin
 begin
  perform original_user_metadata from private.property_image_metadata_archive;
  raise exception 'Anonymous role could read restored private evidence';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
set local role service_role;
do $$begin
 if not exists(select 1 from private.property_image_metadata_archive where object_name='legacy.jpg') then
  raise exception 'Protected service role lost access to recovered proof';
 end if;
end $$;
reset role;
rollback;
