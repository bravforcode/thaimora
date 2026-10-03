-- Minimal SQL model of Storage tables; not a Supabase Storage server/HTTP test.
create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,user_metadata jsonb default '{}',metadata jsonb default '{}');
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated;
grant select,insert,update,delete on storage.objects to authenticated;
insert into storage.objects(bucket_id,name,user_metadata,metadata) values(
 'property-images','legacy.jpg','{"sanitized":true,"rights_evidence":"https://rights.example.test/private-proof","private_note":"private owner data"}',
 '{"mimetype":"image/jpeg","size":123}'
);
