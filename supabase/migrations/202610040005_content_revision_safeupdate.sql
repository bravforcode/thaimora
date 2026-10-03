-- PostgREST sessions enforce pg-safeupdate; update only the singleton revision row.
begin;
create or replace function private.bump_content_revision() returns trigger language plpgsql security definer set search_path=pg_catalog,private as $$
begin
 if tg_op='UPDATE' and to_jsonb(new)=to_jsonb(old) then return new;end if;
 update private.content_revision set revision=revision+1,
 pois=pois+case when tg_table_name='pois' then 1 else 0 end,
 events=events+case when tg_table_name='events' then 1 else 0 end,
 home=home+case when tg_table_name in ('site_settings','hotels','hotel_images','hotel_provider_ids','hotel_amenities','hotel_content','zones') then 1 else 0 end
 where singleton=true;
 if tg_op='DELETE' then return old;else return new;end if;
end;$$;
revoke all on function private.bump_content_revision() from public,anon,authenticated,service_role;
commit;
