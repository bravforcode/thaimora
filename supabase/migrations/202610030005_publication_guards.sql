create or replace function public.validate_property_publication() returns trigger language plpgsql set search_path=public as $$
declare private property_private_locations;
begin
 if new.published then
  if new.rights_status<>'approved' or coalesce(new.ownership_evidence,'')='' or new.ownership='unknown' then raise exception 'Publication requires rights and ownership evidence';end if;
  if coalesce(new.title->>'en','')='' or coalesce(new.title->>'th','')='' or coalesce(new.description->>'en','')='' or coalesce(new.description->>'th','')='' then raise exception 'Bilingual content required';end if;
  select * into private from property_private_locations where property_id=new.id;
  if private.property_id is null or new.public_location is null then raise exception 'Private location and approved projection required';end if;
  if private.exact_publication_consent then
   if new.public_location->>'accuracy'<>'exact' or (new.public_location->>'lat')::float<>private.lat or (new.public_location->>'lng')::float<>private.lng then raise exception 'Invalid consented projection';end if;
  else
   if new.public_location->>'accuracy'<>'approximate' or (new.public_location->>'radiusMeters')::int<300 or (new.public_location->>'lat')::numeric<>round(private.lat::numeric/0.002)*0.002 or (new.public_location->>'lng')::numeric<>round(private.lng::numeric/0.002)*0.002 then raise exception 'Invalid approximate projection';end if;
  end if;
  if not exists(select 1 from property_images where property_id=new.id and rights_status='approved' and coalesce(rights_evidence,'')<>'')then raise exception 'Approved image rights evidence required';end if;
 end if;
 new.updated_at=now();return new;
end; $$;
