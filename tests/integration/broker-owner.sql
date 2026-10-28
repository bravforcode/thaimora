-- tests/integration/broker-owner.sql
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('00000000-0000-4000-8000-0000000000a1','owner@test.local',now()),
 ('00000000-0000-4000-8000-0000000000b1','broker@test.local',now());
update private.broker_config set billing_enabled=true,stripe_price_id='price_test1',stripe_live_mode=false,terms_version='terms-test-1' where singleton;

select public.broker_register('00000000-0000-4000-8000-0000000000a1','Owner One',null,null,'terms-test-1','owner');
select public.broker_register('00000000-0000-4000-8000-0000000000b1','Broker One',null,null,'terms-test-1');

do $$
declare owner_id uuid:='00000000-0000-4000-8000-0000000000a1';broker_id uuid:='00000000-0000-4000-8000-0000000000b1';
begin
 assert (select account_kind from private.broker_profiles where user_id=owner_id)='owner';
 assert (select approval_status from private.broker_profiles where user_id=owner_id)='pending','owner waits for admin approval';
 assert (select approval_status from private.broker_profiles where user_id=broker_id)='approved','broker keeps auto approval';
 assert public.broker_is_entitled(owner_id) is false;

 update private.broker_billing set status='active',paid=true,current_period_end=now()+interval '30 days',
  verified_price_id='price_test1',verified_live_mode=false where user_id=owner_id;
 assert public.broker_is_entitled(owner_id) is false,'pending owner stays blocked even when paid';

 update private.broker_profiles set approval_status='approved' where user_id=owner_id;
 assert public.broker_is_entitled(owner_id) is true,'approved paid owner is entitled';
 assert (public.broker_context(owner_id)->'profile'->>'accountKind')='owner';
end $$;
rollback;
