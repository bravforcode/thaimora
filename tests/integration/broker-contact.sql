-- Hosted-safe synthetic assertions. Every named fixture/configuration change rolls back.
begin;
do $$
declare a uuid:='fefefefe-0000-4000-8000-000000000001';b uuid:='fefefefe-0000-4000-8000-000000000002';staff uuid:='fefefefe-0000-4000-8000-000000000003';
 property uuid;foreign_property uuid;iid uuid;claim jsonb;other_claim jsonb;state jsonb;result jsonb;task jsonb;line_id text:='U'||repeat('a',32);fields jsonb;
begin
 if has_schema_privilege('anon','private','USAGE') or has_schema_privilege('authenticated','private','USAGE') then raise exception 'Private broker schema exposed';end if;
 if has_function_privilege('authenticated','public.broker_register(uuid,text,text,text,text)','EXECUTE')
 or has_function_privilege('anon','public.broker_context(uuid)','EXECUTE')
 or has_function_privilege('authenticated','public.contact_save_preferences(uuid,text,boolean,boolean,text)','EXECUTE') then raise exception 'Client may mutate broker state';end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private'
 and(c.relname like 'broker_%' or c.relname like 'contact_%' or c.relname in('property_contact_recipients','inquiry_recipients','line_account_links','line_webhook_events'))
 and not c.relrowsecurity and c.relkind='r') then raise exception 'Missing private RLS';end if;
 if exists(select 1 from private.broker_profiles where user_id in(a,b,staff)) then raise exception 'Fixture already exists';end if;
 insert into auth.users(id,email,email_confirmed_at) values(a,'broker-a@example.invalid',now()),(b,'broker-b@example.invalid',now()),(staff,'staff@example.invalid',now());
 insert into public.admin_memberships(user_id,role) values(staff,'admin');
 update private.broker_config set billing_enabled=false,terms_version='rollback-terms-v1',stripe_price_id='price_Fixture',stripe_live_mode=false where singleton;
 result:=public.broker_register(a,'Broker A',null,null,'rollback-terms-v1');
 perform public.broker_register(b,'Broker B',null,null,'rollback-terms-v1');
 if result->'profile'->>'approvalStatus'<>'approved' or (result->'entitlement'->>'active')::boolean then raise exception 'Default approval or unconfigured billing gate failed';end if;
 perform public.contact_ensure_account(a,'broker-a@example.invalid');perform public.contact_ensure_account(b,'broker-b@example.invalid');
 perform public.broker_bind_customer(a,'cus_FixtureA');perform public.broker_bind_customer(b,'cus_FixtureB');
 begin perform public.broker_bind_customer(a,'cus_Impersonator');raise exception 'Customer binding changed';exception when raise_exception then if sqlerrm='Customer binding changed' then raise;end if;end;
 update private.broker_config set billing_enabled=true where singleton;
 claim:=public.broker_start_checkout(a);
 if not public.broker_finish_checkout(a,(claim->>'leaseToken')::uuid,'https://checkout.stripe.com/c/pay/cs_rollback_fixture',now()+interval '1 hour') then raise exception 'Checkout cache fixture failed';end if;
 if public.broker_start_checkout(a)->>'url' is null then raise exception 'Matching checkout cache not reused';end if;
 update private.broker_config set stripe_price_id='price_Changed' where singleton;
 claim:=public.broker_start_checkout(a);
 if claim->>'url' is not null or claim->>'leaseToken' is null then raise exception 'Changed Price reused cached checkout';end if;
 perform public.broker_finish_checkout(a,(claim->>'leaseToken')::uuid,null,null);
 update private.broker_config set stripe_price_id='price_Fixture',stripe_live_mode=true where singleton;
 begin perform public.broker_start_checkout(a);raise exception 'Live mode reused test customer/cache';exception when raise_exception then if sqlerrm='Live mode reused test customer/cache' then raise;end if;end;
 update private.broker_config set stripe_live_mode=false where singleton;
 state:=jsonb_build_object('priceId','price_Fixture','liveMode',false,'subscriptionId','sub_FixtureA','status','active','paid',true,'currentPeriodEnd',now()+interval '1 day','cancelAtPeriodEnd',false);
 claim:=public.broker_claim_payment_event('evt_FixtureA','invoice.paid','cus_FixtureA');
 other_claim:=public.broker_claim_payment_event('evt_Concurrent','customer.subscription.updated','cus_FixtureA');
 if other_claim->>'busy'<>'true' then raise exception 'Concurrent customer lease accepted';end if;
 if not public.broker_finish_payment_event('evt_FixtureA',(claim->>'leaseToken')::uuid,state) then raise exception 'Verified payment apply failed';end if;
 if not public.broker_is_entitled(a) then raise exception 'Paid broker needs unwanted staff approval';end if;
 if public.broker_claim_payment_event('evt_FixtureA','invoice.paid','cus_FixtureA')->>'duplicate'<>'true' then raise exception 'Processed payment replay accepted';end if;
 claim:=public.broker_claim_payment_event('evt_FixtureB','invoice.paid','cus_FixtureB');
 if not public.broker_finish_payment_event('evt_FixtureB',(claim->>'leaseToken')::uuid,state||jsonb_build_object('subscriptionId','sub_FixtureB')) then raise exception 'Second broker payment failed';end if;
 update private.broker_config set stripe_price_id='price_Changed' where singleton;
 if public.broker_is_entitled(a) then raise exception 'Unverified changed Price retained entitlement';end if;
 update private.broker_config set stripe_price_id='price_Fixture' where singleton;
 update private.broker_billing set current_period_end=now() where user_id=a;
 if public.broker_is_entitled(a) then raise exception 'Exclusive expired paid period grants access';end if;
 update private.broker_billing set current_period_end=now()+interval '1 day' where user_id=a;
 fields:=jsonb_build_object('slug','broker-rollback-fixture','title',jsonb_build_object('en','Own property','th','Own property TH'),
 'description',jsonb_build_object('en','Owned listing fixture','th','Owned listing fixture TH'),'transaction','sale','type','villa',
 'price_thb',1000000,'area_m2',100,'beds',2,'baths',2,'ownership','freehold','furnishing','furnished','status','available','zone','Bang Tao',
 'province','Phuket','amenities','[]'::jsonb,'source_url','https://owner.example.invalid/listing','ownership_evidence','rollback-only proof');
 property:=public.broker_save_listing(a,null,fields,jsonb_build_object('lat',7.98,'lng',98.3),jsonb_build_array(jsonb_build_object('url','https://images.example.invalid/owned.jpg',
 'alt',jsonb_build_object('en','Own photo','th','Own photo TH'),'rights_status','pending','rights_evidence','rollback-only photo proof')));
 foreign_property:=public.broker_save_listing(b,null,fields||jsonb_build_object('slug','foreign-broker-rollback-fixture'),null,null);
 if (select published or rights_status<>'pending' from public.properties where id=property) then raise exception 'Broker bypassed publication review';end if;
 if (select exact_publication_consent from public.property_private_locations where property_id=property) then raise exception 'Broker exposed exact coordinates';end if;
 if jsonb_array_length(public.broker_read_listings(a))<>1 or public.broker_read_listings(a,foreign_property)<>'[]'::jsonb then raise exception 'Cross-broker listing leak';end if;
 begin perform public.broker_save_listing(a,foreign_property,'{}'::jsonb,null,null);raise exception 'Foreign broker listing mutated';exception when raise_exception then if sqlerrm='Foreign broker listing mutated' then raise;end if;end;
 begin perform public.broker_save_listing(a,property,jsonb_build_object('published',true),null,null);raise exception 'Broker publication granted';exception when raise_exception then if sqlerrm='Broker publication granted' then raise;end if;end;
 perform public.broker_submit_listing(a,property);
 if (select review_status from private.broker_listings where property_id=property)<>'submitted' then raise exception 'Listing review request failed';end if;
 -- Staff approves publication through the existing authorized rights/location guards.
 update public.property_images set rights_status='approved' where property_id=property;
 update public.properties set rights_status='approved',published=true where id=property;
 if not public.property_is_public(property) then raise exception 'Owned approved fixture not eligible';end if;
 -- Lead snapshot exists even when all notification channels are opted out.
 result:=public.submit_contact_inquiry(property,'Customer fixture','visitor@example.invalid','TH','Please contact me about this exact property.','broker-contact-fixture-key-1','broker-contact-fixture-payload-1',true);
 iid:=(result->>'id')::uuid;
 if result->>'contactStatus'<>'unavailable' or not exists(select 1 from private.inquiry_recipients where inquiry_id=iid and recipient_user_id=a) then raise exception 'Private opted-out lead snapshot missing';end if;
 if jsonb_array_length(public.broker_read_leads(a))<>1 or public.broker_read_leads(b)<>'[]'::jsonb then raise exception 'Cross-broker lead leak';end if;
 perform public.broker_update_lead(a,iid,'contacted');
 begin perform public.broker_update_lead(b,iid,'closed');raise exception 'Foreign lead changed';exception when raise_exception then if sqlerrm='Foreign lead changed' then raise;end if;end;
 -- Verified recipient channel consent creates two immutable notifications.
 perform public.contact_save_preferences(a,'broker-a@example.invalid',true,false,'contact-relay-v1');
 perform public.contact_record_line_token(repeat('1',64),line_id);
 if not public.contact_prepare_line_link(a,repeat('1',64),repeat('2',64)) then raise exception 'Link nonce creation failed';end if;
 if public.contact_apply_line_event('wrong-line-link','accountLink','U'||repeat('b',32),repeat('2',64),true) then raise exception 'Foreign LINE user bound';end if;
 if not public.contact_apply_line_event('correct-line-link','accountLink',line_id,repeat('2',64),true) then raise exception 'Verified accountLink failed';end if;
 if public.contact_apply_line_event('correct-line-link','accountLink',line_id,repeat('2',64),true) then raise exception 'LINE signed event replay accepted';end if;
 perform public.contact_save_preferences(a,'broker-a@example.invalid',true,true,'contact-relay-v1');
 result:=public.submit_contact_inquiry(property,'Customer fixture','visitor@example.invalid','TH','Please contact me about this exact property.','broker-contact-fixture-key-2','broker-contact-fixture-payload-2',true);
 iid:=(result->>'id')::uuid;
 if (select count(*) from private.contact_outbox where inquiry_id=iid)<>2 then raise exception 'Exact recipient/channel outbox missing';end if;
 perform public.submit_contact_inquiry(property,'Customer fixture','visitor@example.invalid','TH','Please contact me about this exact property.','broker-contact-fixture-key-2','broker-contact-fixture-payload-2',true);
 if (select count(*) from private.contact_outbox where inquiry_id=iid)<>2 then raise exception 'Inquiry replay duplicated notifications';end if;
 if public.contact_claim_batch() <> '[]'::jsonb then raise exception 'Delivery enabled before accounts';end if;
 update private.contact_config set delivery_enabled=true where singleton;
 result:=public.contact_claim_batch();
 select value into task from jsonb_array_elements(result) where value->>'channel'='email';
 if public.contact_delivery_payload((task->>'id')::uuid,(task->>'lease_token')::uuid) is null then raise exception 'Authorized delivery absent';end if;
 update auth.users set email='changed-address@example.invalid',email_confirmed_at=now() where id=a;
 if public.contact_delivery_payload((task->>'id')::uuid,(task->>'lease_token')::uuid) is not null and task->>'channel'='email' then raise exception 'Auth email change retained former destination';end if;
 perform public.contact_save_preferences(a,'changed-address@example.invalid',true,true,'contact-relay-v1');
 if public.contact_delivery_payload((task->>'id')::uuid,(task->>'lease_token')::uuid) is not null and task->>'channel'='email' then raise exception 'Retry key reused with new email destination';end if;
 -- Recipient changes do not expose former leads to the new assignee.
 perform public.admin_assign_contact(staff,property,b);
 if public.broker_read_leads(b)<>'[]'::jsonb then raise exception 'Reassignment leaked historical visitor';end if;
 if exists(select 1 from private.contact_outbox where inquiry_id=iid and status='sending') then raise exception 'Reassigned recipient queue not canceled';end if;
 perform public.contact_save_preferences(a,'changed-address@example.invalid',false,false,null);
 perform public.contact_unlink_line(a);
 if public.contact_preferences(a)->>'lineLinked'<>'false' or exists(select 1 from private.line_account_links where user_id=a) then raise exception 'Unlink retained nonce/binding';end if;
 -- A refunded payment remains blocked when a later positive callback arrives.
 claim:=public.broker_claim_payment_event('evt_Refund','charge.refunded','cus_FixtureA');
 perform public.broker_finish_payment_event('evt_Refund',(claim->>'leaseToken')::uuid,state||jsonb_build_object('blockedReason','refund_review_required'));
 claim:=public.broker_claim_payment_event('evt_LaterActive','customer.subscription.updated','cus_FixtureA');
 perform public.broker_finish_payment_event('evt_LaterActive',(claim->>'leaseToken')::uuid,state);
 if public.broker_is_entitled(a) then raise exception 'Refunded subscription silently restored';end if;
 begin perform public.broker_read_leads(a);raise exception 'Expired/blocked broker read PII';exception when raise_exception then if sqlerrm='Expired/blocked broker read PII' then raise;end if;end;
 -- Nonpaid owners can still revoke channels and unlink.
 perform public.contact_save_preferences(a,'changed-address@example.invalid',false,false,null);perform public.contact_unlink_line(a);
 update auth.users set email_confirmed_at=null where id=a;
 perform public.contact_save_preferences(a,'',false,false,null);perform public.contact_unlink_line(a);
 -- Explicit staff suspension also revokes a otherwise paid broker.
 perform public.admin_review_broker(staff,b,'suspended');if public.broker_is_entitled(b) then raise exception 'Suspension did not revoke access';end if;
 -- Test-to-live setup may reset only test bindings while billing is disabled.
 update private.broker_config set billing_enabled=false where singleton;
 perform public.admin_reset_broker_test_billing(staff,a,true);
 if (select stripe_customer_id from private.broker_billing where user_id=a) is not null then raise exception 'Test reset kept customer';end if;
 if not exists(select 1 from public.admin_audit_log where table_name='broker_billing' and record_id=a::text and metadata->>'operation'='RESET_TEST_BINDING') then raise exception 'Test reset missing audit';end if;
 update private.broker_billing set customer_live_mode=true where user_id=b;
 begin perform public.admin_reset_broker_test_billing(staff,b,true);raise exception 'Live customer reset accepted';exception when raise_exception then if sqlerrm='Live customer reset accepted' then raise;end if;end;
 if not public.consume_contact_nonce('fefefefe-0000-4000-8000-000000000009',floor(extract(epoch from now()))::bigint)
 or public.consume_contact_nonce('fefefefe-0000-4000-8000-000000000009',floor(extract(epoch from now()))::bigint) then raise exception 'Worker nonce replay guard failed';end if;
end;$$;
rollback;
