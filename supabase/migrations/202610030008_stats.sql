create function public.record_property_view(p_property uuid) returns void language sql security definer set search_path=public as $$
insert into daily_property_stats(day,property_id,views)
select (now() at time zone 'UTC')::date,id,1 from properties where id=p_property and published
on conflict(day,property_id)do update set views=daily_property_stats.views+1; $$;
revoke all on function record_property_view(uuid) from public,anon,authenticated;
grant execute on function record_property_view(uuid) to service_role;
create function public.inquiry_daily_stat() returns trigger language plpgsql security definer set search_path=public as $$
begin
insert into daily_property_stats(day,property_id,inquiries) values((new.created_at at time zone 'UTC')::date,new.property_id,1)
on conflict(day,property_id)do update set inquiries=daily_property_stats.inquiries+1;
return new;
end; $$;
create trigger inquiry_stat after insert on inquiries for each row execute function inquiry_daily_stat();
