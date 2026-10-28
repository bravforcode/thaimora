-- supabase/migrations/202610270002_broker_reports.sql
begin;
alter table public.inquiries add column first_response_at timestamptz;

create function public.inquiry_first_response_guard() returns trigger language plpgsql set search_path=pg_catalog as $$
begin
 if old.status='new' and new.status is distinct from 'new' and new.first_response_at is null then new.first_response_at:=now();end if;
 return new;
end;$$;
revoke all on function public.inquiry_first_response_guard() from public,anon,authenticated;
create trigger inquiry_first_response before update of status on public.inquiries
 for each row execute function public.inquiry_first_response_guard();

-- Leads are inquiries routed to the actor AND attached to a listing the actor owns.
-- Day boundary is Asia/Bangkok, matching daily_property_stats.inquiries (migration 202610030010).
create function private.broker_lead_rows(p_actor uuid,p_from date,p_to date) returns table(created_at timestamptz,row_json jsonb)
 language sql stable set search_path=pg_catalog,public,private as $$
 select i.created_at,jsonb_build_object('id',i.id,'propertyId',i.property_id,'name',i.name,'email',i.email,'country',i.country,
  'message',i.message,'status',i.status,'createdAt',i.created_at,'firstResponseAt',i.first_response_at)
 from public.inquiries i
 join private.inquiry_recipients r on r.inquiry_id=i.id and r.recipient_user_id=p_actor
 join private.broker_listings l on l.property_id=i.property_id and l.user_id=p_actor
 where (i.created_at at time zone 'Asia/Bangkok')::date between p_from and p_to;
$$;
revoke all on function private.broker_lead_rows(uuid,date,date) from public,anon,authenticated;

create function public.broker_report(p_actor uuid,p_from date,p_to date) returns jsonb
 language plpgsql stable security definer set search_path=pg_catalog,private,public as $$
declare result jsonb;
begin
 if not public.broker_is_entitled(p_actor) then raise exception 'Paid broker access required';end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>365 then raise exception 'Report range invalid';end if;
 if (select count(*) from private.broker_listings where user_id=p_actor)>1000 then raise exception 'Broker record page required';end if;
 with mine as(select l.property_id from private.broker_listings l where l.user_id=p_actor),
 stats as(select s.* from public.daily_property_stats s join mine m on m.property_id=s.property_id where s.day between p_from and p_to),
 per_listing as(select property_id,sum(views)::bigint views,sum(inquiries)::bigint inquiries,sum(contact_clicks)::bigint contact_clicks from stats group by property_id),
 per_day as(select day,sum(views)::bigint views,sum(inquiries)::bigint inquiries,sum(contact_clicks)::bigint contact_clicks from stats group by day),
 leads as(select created_at,row_json->>'status' status,(row_json->>'firstResponseAt')::timestamptz first_response_at from private.broker_lead_rows(p_actor,p_from,p_to))
 select jsonb_build_object(
  'totals',jsonb_build_object(
    'views',coalesce((select sum(views) from per_listing),0),
    'inquiries',coalesce((select sum(inquiries) from per_listing),0),
    'contactClicks',coalesce((select sum(contact_clicks) from per_listing),0),
    'leads',(select count(*) from leads),
    'newLeads',(select count(*) from leads where status='new'),
    'contactedLeads',(select count(*) from leads where status='contacted'),
    'closedLeads',(select count(*) from leads where status='closed'),
    'respondedLeads',(select count(*) from leads where first_response_at is not null),
    'medianResponseSeconds',(select percentile_cont(0.5) within group(order by extract(epoch from first_response_at-created_at))
      from leads where first_response_at is not null)),
  'daily',coalesce((select jsonb_agg(jsonb_build_object('day',d.day,'views',d.views,'inquiries',d.inquiries,'contactClicks',d.contact_clicks) order by d.day) from per_day d),'[]'::jsonb),
  'listings',coalesce((select jsonb_agg(jsonb_build_object('propertyId',p.id,'title',p.title,'slug',p.slug,'published',p.published,
     'views',coalesce(x.views,0),'inquiries',coalesce(x.inquiries,0),'contactClicks',coalesce(x.contact_clicks,0))
     order by coalesce(x.views,0) desc,p.slug)
    from mine m join public.properties p on p.id=m.property_id left join per_listing x on x.property_id=m.property_id),'[]'::jsonb))
 into result;
 return result;
end;$$;

create function public.broker_report_leads(p_actor uuid,p_from date,p_to date,p_before timestamptz,p_limit integer) returns jsonb
 language plpgsql stable security definer set search_path=pg_catalog,private,public as $$
declare result jsonb;
begin
 if not public.broker_is_entitled(p_actor) then raise exception 'Paid broker access required';end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>365 then raise exception 'Report range invalid';end if;
 select coalesce(jsonb_agg(page.row_json order by page.created_at desc),'[]'::jsonb) into result from(
  select created_at,row_json from private.broker_lead_rows(p_actor,p_from,p_to)
  where p_before is null or created_at<p_before
  order by created_at desc limit least(greatest(coalesce(p_limit,50),1),200)) page;
 return result;
end;$$;

create function public.broker_report_export(p_actor uuid,p_kind text,p_from date,p_to date) returns jsonb
 language plpgsql stable security definer set search_path=pg_catalog,private,public as $$
declare result jsonb;n integer;
begin
 if not public.broker_is_entitled(p_actor) then raise exception 'Paid broker access required';end if;
 if p_kind not in('leads','listings') then raise exception 'Invalid export kind';end if;
 if p_kind='listings' then return (public.broker_report(p_actor,p_from,p_to))->'listings';end if;
 select count(*) into n from private.broker_lead_rows(p_actor,p_from,p_to);
 if n>10000 then raise exception 'Export limit exceeded';end if;
 select coalesce(jsonb_agg(row_json order by created_at desc),'[]'::jsonb) into result from private.broker_lead_rows(p_actor,p_from,p_to);
 return result;
end;$$;

do $$declare fn regprocedure;begin
 for fn in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and (p.proname like 'broker_%' or p.proname in('admin_review_broker','admin_list_brokers','admin_reset_broker_test_billing')) loop
  execute format('revoke all on function %s from public,anon,authenticated',fn);
  if fn::text not like '%broker_listing_guard%' then execute format('grant execute on function %s to service_role',fn);end if;
 end loop;
end;$$;
commit;
