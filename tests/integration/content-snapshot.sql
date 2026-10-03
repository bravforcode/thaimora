-- Read-only assertions inside a rollback transaction; no production fixture writes.
begin;
set local role anon;
do $$declare data jsonb;event_data jsonb;n integer;begin
 data:=public.public_content_snapshot('full');
 select count(*) into n from public.public_pois;
 if jsonb_array_length(data->'pois')<>n then raise exception 'Public snapshot truncated the place catalog';end if;
 select count(*) into n from public.public_events;
 if jsonb_array_length(data->'events')<>n then raise exception 'Public snapshot truncated the event catalog';end if;
 if data->'meta' is distinct from public.public_content_meta() then raise exception 'Snapshot metadata is inconsistent';end if;
 if exists(select 1 from jsonb_array_elements(data->'events') e where (e->>'ends_at')::timestamptz<=now()) then raise exception 'Snapshot included expired events';end if;
 if exists(select 1 from jsonb_array_elements(data->'pois') p where p?'rights_evidence' or p?'admin_override' or p?'source_quarantine') then raise exception 'Snapshot leaked private content fields';end if;
 event_data:=public.public_content_snapshot('events');
 if event_data?'pois' or event_data?'homeSettings' or event_data->'events' is distinct from data->'events' then raise exception 'Event snapshot queried full content';end if;
 begin perform public.public_content_snapshot('private');raise exception 'Expected invalid scope rejection';exception when others then if SQLERRM='Expected invalid scope rejection' then raise;end if;end;
 if to_regprocedure('public.public_home_settings_value()') is not null then
  if not(data?'homeSettings') or (data->'homeSettings') is distinct from coalesce(public.public_home_settings_value(),'null'::jsonb) then raise exception 'Homepage snapshot differs from reviewed public settings';end if;
 elsif data?'homeSettings' then raise exception 'Property snapshot unexpectedly contains hotel settings';end if;
end$$;
reset role;
rollback;
