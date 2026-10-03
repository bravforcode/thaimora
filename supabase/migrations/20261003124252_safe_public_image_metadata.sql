-- Public Storage object-info returns user_metadata. Never put private rights evidence there.
-- Rights references remain in protected property_images rows and publication validation.
create schema if not exists private;
revoke all on schema private from public,anon,authenticated;
grant usage on schema private to service_role;
create table if not exists private.property_image_metadata_archive(
 object_id uuid primary key,
 bucket_id text not null,
 object_name text not null,
 original_user_metadata jsonb not null,
 archived_at timestamptz not null default now()
);
alter table private.property_image_metadata_archive enable row level security;
revoke all on private.property_image_metadata_archive from public,anon,authenticated;
grant select,insert on private.property_image_metadata_archive to service_role;
do $$begin
 if to_regclass('storage.objects') is not null and exists(
   select 1 from information_schema.columns where table_schema='storage' and table_name='objects' and column_name='user_metadata'
 ) then
  -- Preserve the exact legacy record before scrubbing, including orphaned upload evidence.
  insert into private.property_image_metadata_archive(object_id,bucket_id,object_name,original_user_metadata)
    select id,bucket_id,name,user_metadata from storage.objects
    where bucket_id='property-images' and user_metadata is not null
      and user_metadata - array['sanitized','rights_confirmed']::text[] <> '{}'::jsonb
    on conflict(object_id) do nothing;
  update storage.objects set user_metadata=jsonb_build_object(
    'sanitized',coalesce(user_metadata->'sanitized','false'::jsonb)='true'::jsonb,
    'rights_confirmed',coalesce(user_metadata->'rights_confirmed','false'::jsonb)='true'::jsonb
       or length(coalesce(user_metadata->>'rights_evidence',''))>0
  ) where bucket_id='property-images';
  execute 'drop policy if exists property_image_admin_insert on storage.objects';
  execute 'drop policy if exists property_image_admin_update on storage.objects';
  execute $policy$create policy property_image_admin_insert on storage.objects for insert to authenticated
    with check(bucket_id='property-images' and public.is_admin()
      and user_metadata='{"sanitized":true,"rights_confirmed":true}'::jsonb
      and name ~ '\.(jpg|jpeg|png|webp)$')$policy$;
  execute $policy$create policy property_image_admin_update on storage.objects for update to authenticated
    using(bucket_id='property-images' and public.is_admin())
    with check(bucket_id='property-images' and public.is_admin()
      and user_metadata='{"sanitized":true,"rights_confirmed":true}'::jsonb
      and name ~ '\.(jpg|jpeg|png|webp)$')$policy$;
 end if;
end $$;
