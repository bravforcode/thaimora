-- Hosted Supabase owns storage schema. Standalone SQL tests deliberately do not pretend to test Storage.
do $$begin
 if to_regclass('storage.buckets') is not null then
  insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('property-images','property-images',true,8388608,array['image/jpeg','image/png','image/webp'])
  on conflict(id) do update set public=true,file_size_limit=8388608,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
  if exists(select 1 from information_schema.columns where table_schema='storage' and table_name='objects' and column_name='user_metadata')then
   execute 'create policy property_image_admin_insert on storage.objects for insert to authenticated with check(bucket_id=''property-images'' and public.is_admin() and coalesce(user_metadata->>''sanitized'','''')=''true'' and length(coalesce(user_metadata->>''rights_evidence'',''''))>0 and name ~ ''\.(jpg|jpeg|png|webp)$'')';
   execute 'create policy property_image_admin_update on storage.objects for update to authenticated using(bucket_id=''property-images'' and public.is_admin()) with check(bucket_id=''property-images'' and public.is_admin() and coalesce(user_metadata->>''sanitized'','''')=''true'' and length(coalesce(user_metadata->>''rights_evidence'',''''))>0)';
   execute 'create policy property_image_admin_delete on storage.objects for delete to authenticated using(bucket_id=''property-images'' and public.is_admin())';
   execute 'create policy property_image_admin_read on storage.objects for select to authenticated using(bucket_id=''property-images'' and public.is_admin())';
  end if;
 end if;
end $$;
