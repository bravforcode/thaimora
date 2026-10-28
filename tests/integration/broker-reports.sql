-- tests/integration/broker-reports.sql
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('00000000-0000-4000-8000-0000000000a1','owner@test.local',now()),
 ('00000000-0000-4000-8000-0000000000c1','other@test.local',now());
update private.broker_config set billing_enabled=true,stripe_price_id='price_test1',stripe_live_mode=false,
 terms_version='terms-test-1',owner_approval_required=false where singleton;
select public.broker_register('00000000-0000-4000-8000-0000000000a1','Owner One',null,null,'terms-test-1','owner');
update private.broker_billing set status='active',paid=true,current_period_end=now()+interval '30 days',
 verified_price_id='price_test1',verified_live_mode=false where user_id='00000000-0000-4000-8000-0000000000a1';

do $$
declare owner_id uuid:='00000000-0000-4000-8000-0000000000a1';other_id uuid:='00000000-0000-4000-8000-0000000000c1';
 r jsonb;lead_id uuid;pid uuid;fields jsonb;daily_views integer;
begin
 perform public.contact_ensure_account(owner_id,'owner@test.local');
 fields:=jsonb_build_object('slug','broker-report-fixture','title',jsonb_build_object('en','Own property','th','Own property TH'),
  'description',jsonb_build_object('en','Owned listing fixture','th','Owned listing fixture TH'),'transaction','sale','type','villa',
  'price_thb',1000000,'area_m2',100,'beds',2,'baths',2,'ownership','freehold','furnishing','furnished','status','available','zone','Bang Tao',
  'province','Phuket','amenities','[]'::jsonb,'source_url','https://owner.example.invalid/listing','ownership_evidence','rollback-only proof');
 pid:=public.broker_save_listing(owner_id,null,fields,null,null);
 update public.properties set rights_status='approved',published=true where id=pid;
 insert into public.daily_property_stats(day,property_id,views) values('2026-10-20',pid,3);
 insert into public.inquiries(property_id,name,email,country,message,idempotency_hash,payload_hash)
  values(pid,'Customer fixture','visitor@example.invalid','TH','Please contact me about this exact property.','broker-report-fixture-hash','broker-report-fixture-payload')
  returning id into lead_id;
 insert into private.inquiry_recipients(inquiry_id,recipient_user_id,consent_version) values(lead_id,owner_id,'broker-report-fixture');

 -- The inquiry trigger also adds today's row, so assert the series sum, not its length.
 r:=public.broker_report(owner_id,'2026-01-01','2026-12-31');
 select coalesce(sum((d->>'views')::int),0) into daily_views from jsonb_array_elements(r->'daily') d;
 assert (r->'totals'->>'views')::int=3,'owner sees own views only';
 assert daily_views=3,'daily series sums to total views';
 assert jsonb_array_length(r->'listings')=1;
 assert (r->'totals'->>'newLeads')::int=1;
 assert (r->'totals'->>'respondedLeads')::int=0;

 begin
  perform public.broker_report(other_id,'2026-01-01','2026-12-31');
  raise exception 'expected entitlement failure';
 exception when others then
  assert sqlerrm like '%Paid broker access required%',sqlerrm;
 end;

 begin
  perform public.broker_report(owner_id,'2026-10-27','2026-10-01');
  raise exception 'expected range failure';
 exception when others then
  assert sqlerrm like '%Report range invalid%',sqlerrm;
 end;

 update public.inquiries set status='contacted' where id=lead_id;
 r:=public.broker_report(owner_id,'2026-01-01','2026-12-31');
 assert (r->'totals'->>'respondedLeads')::int=1,'first status change records response time';
 assert (r->'totals'->>'medianResponseSeconds') is not null;
 assert jsonb_array_length(public.broker_report_leads(owner_id,'2026-01-01','2026-12-31',null,50))=1;
 assert jsonb_array_length(public.broker_report_export(owner_id,'leads','2026-01-01','2026-12-31'))=1;
 assert jsonb_array_length(public.broker_report_export(owner_id,'listings','2026-01-01','2026-12-31'))=1;
end $$;
rollback;
