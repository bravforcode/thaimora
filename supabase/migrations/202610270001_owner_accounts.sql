-- supabase/migrations/202610270001_owner_accounts.sql
-- Owner accounts reuse the broker membership, entitlement, billing and listing contracts.
begin;
alter table private.broker_profiles add column account_kind text not null default 'broker' check(account_kind in('broker','owner'));
alter table private.broker_config add column owner_approval_required boolean not null default true;

create function private.broker_approval_satisfied(c private.broker_config,p private.broker_profiles) returns boolean
 language sql stable as $$
 select p.approval_status='approved'
  or(p.approval_status='pending' and not c.approval_required and not(p.account_kind='owner' and c.owner_approval_required));
$$;
revoke all on function private.broker_approval_satisfied(private.broker_config,private.broker_profiles) from public,anon,authenticated;

drop function public.broker_register(uuid,text,text,text,text);
create function public.broker_register(p_actor uuid,p_name text,p_company text,p_phone text,p_terms text,p_kind text default 'broker')
 returns jsonb language plpgsql security definer set search_path=pg_catalog,private,public as $$
declare c private.broker_config;needs_review boolean;
begin
 select * into c from private.broker_config where singleton;
 if p_actor is null or not exists(select 1 from auth.users where id=p_actor) then raise exception 'Authenticated user required';end if;
 if p_kind not in('broker','owner') then raise exception 'Invalid account kind';end if;
 if c.terms_version is null or p_terms is distinct from c.terms_version then raise exception 'Approved broker terms required';end if;
 needs_review:=c.approval_required or(p_kind='owner' and c.owner_approval_required);
 insert into private.broker_profiles(user_id,display_name,company,phone,terms_version,approval_status,approved_at,account_kind)
 values(p_actor,p_name,p_company,p_phone,p_terms,case when needs_review then 'pending' else 'approved' end,case when needs_review then null else now() end,p_kind)
 on conflict(user_id) do update set display_name=excluded.display_name,company=excluded.company,phone=excluded.phone,
  terms_version=excluded.terms_version,terms_accepted_at=now(),updated_at=now();
 -- account_kind is not in the update list: it is fixed at first registration.
 insert into private.broker_billing(user_id) values(p_actor) on conflict(user_id) do nothing;
 return public.broker_context(p_actor);
end;$$;

create or replace function public.broker_is_entitled(p_actor uuid) returns boolean
 language sql stable security definer set search_path=pg_catalog,private as $$
 select coalesce((select c.billing_enabled and private.broker_approval_satisfied(c,p)
  and p.approval_status not in('rejected','suspended') and b.status='active' and b.paid
  and b.blocked_reason is null and b.current_period_end>now()
  and b.verified_price_id=c.stripe_price_id and b.verified_live_mode=c.stripe_live_mode
  from private.broker_profiles p join private.broker_billing b on b.user_id=p.user_id
  cross join private.broker_config c where p.user_id=p_actor and c.singleton),false);
$$;

create or replace function public.broker_start_checkout(p_actor uuid) returns jsonb
 language plpgsql security definer set search_path=pg_catalog,private,public as $$
declare b private.broker_billing;p private.broker_profiles;c private.broker_config;token uuid:=gen_random_uuid();
begin
 select * into p from private.broker_profiles where user_id=p_actor;
 select * into c from private.broker_config where singleton;
 if p.user_id is null or not c.billing_enabled or p.approval_status in('suspended','rejected')
 or not private.broker_approval_satisfied(c,p) then raise exception 'Broker checkout unavailable';end if;
 select * into b from private.broker_billing where user_id=p_actor for update;
 if b.stripe_customer_id is not null and b.customer_live_mode is distinct from c.stripe_live_mode then raise exception 'Test billing reset required';end if;
 if public.broker_is_entitled(p_actor) then raise exception 'Subscription already active';end if;
 if b.blocked_reason is not null then raise exception 'Billing review required';end if;
 if b.lease_until>now() then return jsonb_build_object('busy',true);end if;
 if b.checkout_url is not null and b.checkout_expires_at>now() and b.checkout_price_id=c.stripe_price_id and b.checkout_live_mode=c.stripe_live_mode then return jsonb_build_object('url',b.checkout_url);end if;
 if b.stripe_subscription_id is not null and b.status in('active','past_due','unpaid','paused','incomplete') then raise exception 'Existing subscription requires portal';end if;
 update private.broker_billing set lease_token=token,lease_until=now()+interval '2 minutes',checkout_price_id=c.stripe_price_id,checkout_live_mode=c.stripe_live_mode where user_id=p_actor;
 return jsonb_build_object('leaseToken',token,'customerId',b.stripe_customer_id,'priceId',c.stripe_price_id,'liveMode',c.stripe_live_mode);
end;$$;

create or replace function public.broker_context(p_actor uuid) returns jsonb
 language sql stable security definer set search_path=pg_catalog,private,public as $$
 select jsonb_build_object(
  'profile',(select jsonb_build_object('id',p.user_id,'displayName',p.display_name,'company',p.company,'phone',p.phone,
   'approvalStatus',p.approval_status,'approvedAt',p.approved_at,'createdAt',p.created_at,'accountKind',p.account_kind)
   from private.broker_profiles p where p.user_id=p_actor),
  'subscription',coalesce((select jsonb_build_object('status',b.status,'currentPeriodEnd',b.current_period_end,
   'cancelAtPeriodEnd',b.cancel_at_period_end) from private.broker_billing b where b.user_id=p_actor),
   jsonb_build_object('status','none','currentPeriodEnd',null,'cancelAtPeriodEnd',false)),
  'entitlement',jsonb_build_object('active',public.broker_is_entitled(p_actor),'reason',
   case when public.broker_is_entitled(p_actor) then 'active'
    when not c.billing_enabled then 'billing_not_configured'
    when not exists(select 1 from private.broker_profiles p where p.user_id=p_actor) then 'registration_required'
    when exists(select 1 from private.broker_profiles p where p.user_id=p_actor and p.approval_status in('rejected','suspended')) then 'approval_denied'
    when exists(select 1 from private.broker_profiles p where p.user_id=p_actor and not private.broker_approval_satisfied(c,p)) then 'approval_required'
    else 'subscription_required' end),
  'billingEnabled',c.billing_enabled) from private.broker_config c where c.singleton;
$$;

do $$declare fn regprocedure;begin
 for fn in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and (p.proname like 'broker_%' or p.proname in('admin_review_broker','admin_list_brokers','admin_reset_broker_test_billing')) loop
  execute format('revoke all on function %s from public,anon,authenticated',fn);
  if fn::text not like '%broker_listing_guard%' then execute format('grant execute on function %s to service_role',fn);end if;
 end loop;
end;$$;
commit;
