-- Broker identities and payment facts are private; client claims never grant access.
begin;
create schema if not exists private;
revoke all on schema private from public,anon,authenticated;
create table private.broker_config (
 singleton boolean primary key default true check(singleton),
 billing_enabled boolean not null default false,
 approval_required boolean not null default false,
 stripe_price_id text,
 stripe_live_mode boolean not null default false,
 amount_minor integer not null default 2500 check(amount_minor=2500),currency text not null default 'usd' check(currency='usd'),
 terms_version text,
 check(not billing_enabled or (stripe_price_id is not null and stripe_price_id ~ '^price_[A-Za-z0-9]+$' and coalesce(length(btrim(terms_version)),0)>0))
);
insert into private.broker_config(singleton) values(true);
create table private.broker_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check(length(btrim(display_name)) between 2 and 100),
 company text check(length(company)<=200), phone text check(length(phone)<=40),
 approval_status text not null default 'pending' check(approval_status in('pending','approved','rejected','suspended')),
 approved_at timestamptz, approved_by uuid references auth.users(id),
 terms_version text not null, terms_accepted_at timestamptz not null default now(),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table private.broker_billing (
 user_id uuid primary key references private.broker_profiles(user_id) on delete cascade,
 stripe_customer_id text unique,customer_live_mode boolean, stripe_subscription_id text unique,
 status text not null default 'none' check(status in('none','incomplete','active','past_due','canceled','unpaid','paused','blocked')),
 current_period_end timestamptz, cancel_at_period_end boolean not null default false,
 paid boolean not null default false, blocked_reason text,
 verified_price_id text,verified_live_mode boolean,
 lease_token uuid, lease_until timestamptz, updated_at timestamptz not null default now(),
 checkout_url text,checkout_expires_at timestamptz,checkout_price_id text,checkout_live_mode boolean,
 check(stripe_customer_id is null or stripe_customer_id ~ '^cus_[A-Za-z0-9]+$'),
 check(stripe_subscription_id is null or stripe_subscription_id ~ '^sub_[A-Za-z0-9]+$')
);
create table private.broker_payment_events (
 event_id text primary key check(event_id ~ '^evt_[A-Za-z0-9]+$'),
 user_id uuid not null references private.broker_profiles(user_id) on delete cascade,
 event_type text not null, status text not null default 'processing' check(status in('processing','processed')),
 lease_token uuid not null, created_at timestamptz not null default now(), processed_at timestamptz
);
create table private.broker_listings (
 property_id uuid primary key references public.properties(id) on delete cascade,
 user_id uuid not null references private.broker_profiles(user_id) on delete cascade,
 review_status text not null default 'draft' check(review_status in('draft','submitted','approved','rejected')),
 submitted_at timestamptz, created_at timestamptz not null default now()
);
create index broker_listings_owner on private.broker_listings(user_id,created_at desc);
do $$declare t text;begin
 foreach t in array array['broker_config','broker_profiles','broker_billing','broker_payment_events','broker_listings'] loop
  execute format('alter table private.%I enable row level security',t);
  execute format('revoke all on private.%I from public,anon,authenticated',t);
  execute format('grant select,insert,update,delete on private.%I to service_role',t);
 end loop;
end;$$;
grant usage on schema private to service_role;

create function public.broker_internal_config() returns jsonb language sql stable security definer set search_path=pg_catalog,private as $$
 select to_jsonb(c) from private.broker_config c where singleton;
$$;
create function public.broker_payment_binding(p_actor uuid) returns jsonb language sql stable security definer set search_path=pg_catalog,private as $$
 select jsonb_build_object('customerId',stripe_customer_id,'customerLiveMode',customer_live_mode,'subscriptionId',stripe_subscription_id,'leaseUntil',lease_until)
 from private.broker_billing where user_id=p_actor;
$$;
create function public.broker_start_checkout(p_actor uuid) returns jsonb
 language plpgsql security definer set search_path=pg_catalog,private,public as $$
declare b private.broker_billing;p private.broker_profiles;c private.broker_config;token uuid:=gen_random_uuid();
begin
 select * into p from private.broker_profiles where user_id=p_actor;
 select * into c from private.broker_config where singleton;
 if p.user_id is null or not c.billing_enabled or p.approval_status in('suspended','rejected')
 or(c.approval_required and p.approval_status<>'approved') then raise exception 'Broker checkout unavailable';end if;
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
create function public.broker_finish_checkout(p_actor uuid,p_token uuid,p_url text,p_expires timestamptz) returns boolean
 language plpgsql security definer set search_path=pg_catalog,private as $$
begin
 if p_url is not null and(p_url !~ '^https://checkout\.stripe\.com/[^[:space:]]+$' or p_expires<=now() or p_expires>now()+interval '25 hours') then raise exception 'Invalid checkout URL';end if;
 update private.broker_billing set checkout_url=p_url,checkout_expires_at=p_expires,
 checkout_price_id=(select stripe_price_id from private.broker_config where singleton),checkout_live_mode=(select stripe_live_mode from private.broker_config where singleton),lease_token=null,lease_until=null
 where user_id=p_actor and lease_token=p_token and lease_until>now()
 and (p_url is null or (checkout_price_id=(select stripe_price_id from private.broker_config where singleton)
 and checkout_live_mode=(select stripe_live_mode from private.broker_config where singleton)));
 return found;
end;$$;
create function public.admin_list_brokers(p_staff uuid) returns jsonb
 language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare result jsonb;
begin
 if not exists(select 1 from public.admin_memberships where user_id=p_staff) then raise exception 'Admin required';end if;
 select coalesce(jsonb_agg((public.broker_context(user_id)->'profile')||jsonb_build_object('subscription',public.broker_context(user_id)->'subscription') order by created_at desc),'[]'::jsonb) into result
 from (select user_id,created_at from private.broker_profiles order by created_at desc limit 1000) p;
 return result;
end;$$;
create function public.broker_read_listings(p_actor uuid,p_id uuid default null) returns jsonb
 language plpgsql stable security definer set search_path=pg_catalog,private,public as $$
declare result jsonb;
begin
 if not public.broker_is_entitled(p_actor) then raise exception 'Paid broker access required';end if;
 if (select count(*) from private.broker_listings where user_id=p_actor and(p_id is null or property_id=p_id))>1000 then raise exception 'Broker record page required';end if;
 select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('broker_review_status',l.review_status,
 'property_private_locations',(select to_jsonb(x) from public.property_private_locations x where x.property_id=p.id),
 'property_images',coalesce((select jsonb_agg(to_jsonb(i) order by i.position,i.id) from public.property_images i where i.property_id=p.id),'[]'::jsonb)) order by p.updated_at desc),'[]'::jsonb)
 into result from public.properties p join private.broker_listings l on l.property_id=p.id
 where l.user_id=p_actor and (p_id is null or p.id=p_id);
 return result;
end;$$;
create function public.broker_is_entitled(p_actor uuid) returns boolean
 language sql stable security definer set search_path=pg_catalog,private as $$
 select coalesce((select c.billing_enabled and (not c.approval_required or p.approval_status='approved')
  and p.approval_status not in('rejected','suspended') and b.status='active' and b.paid
  and b.blocked_reason is null and b.current_period_end>now()
  and b.verified_price_id=c.stripe_price_id and b.verified_live_mode=c.stripe_live_mode
  from private.broker_profiles p join private.broker_billing b on b.user_id=p.user_id
  cross join private.broker_config c where p.user_id=p_actor and c.singleton),false);
$$;
create function public.broker_context(p_actor uuid) returns jsonb
 language sql stable security definer set search_path=pg_catalog,private,public as $$
 select jsonb_build_object(
  'profile',(select jsonb_build_object('id',p.user_id,'displayName',p.display_name,'company',p.company,'phone',p.phone,
   'approvalStatus',p.approval_status,'approvedAt',p.approved_at,'createdAt',p.created_at) from private.broker_profiles p where p.user_id=p_actor),
  'subscription',coalesce((select jsonb_build_object('status',b.status,'currentPeriodEnd',b.current_period_end,
   'cancelAtPeriodEnd',b.cancel_at_period_end) from private.broker_billing b where b.user_id=p_actor),
   jsonb_build_object('status','none','currentPeriodEnd',null,'cancelAtPeriodEnd',false)),
  'entitlement',jsonb_build_object('active',public.broker_is_entitled(p_actor),'reason',
   case when public.broker_is_entitled(p_actor) then 'active'
    when not c.billing_enabled then 'billing_not_configured'
    when not exists(select 1 from private.broker_profiles p where p.user_id=p_actor) then 'registration_required'
    when exists(select 1 from private.broker_profiles p where p.user_id=p_actor and p.approval_status in('rejected','suspended')) then 'approval_denied'
    when c.approval_required and exists(select 1 from private.broker_profiles p where p.user_id=p_actor and p.approval_status<>'approved') then 'approval_required'
    else 'subscription_required' end),
  'billingEnabled',c.billing_enabled) from private.broker_config c where c.singleton;
$$;
create function public.broker_register(p_actor uuid,p_name text,p_company text,p_phone text,p_terms text)
 returns jsonb language plpgsql security definer set search_path=pg_catalog,private,public as $$
declare c private.broker_config;
begin
 select * into c from private.broker_config where singleton;
 if p_actor is null or not exists(select 1 from auth.users where id=p_actor) then raise exception 'Authenticated user required';end if;
 if c.terms_version is null or p_terms is distinct from c.terms_version then raise exception 'Approved broker terms required';end if;
 insert into private.broker_profiles(user_id,display_name,company,phone,terms_version,approval_status,approved_at)
 values(p_actor,p_name,p_company,p_phone,p_terms,case when c.approval_required then 'pending' else 'approved' end,case when not c.approval_required then now() end)
 on conflict(user_id) do update set display_name=excluded.display_name,company=excluded.company,phone=excluded.phone,
  terms_version=excluded.terms_version,terms_accepted_at=now(),updated_at=now();
 insert into private.broker_billing(user_id) values(p_actor) on conflict(user_id) do nothing;
 return public.broker_context(p_actor);
end;$$;
create function public.admin_review_broker(p_staff uuid,p_actor uuid,p_status text)
 returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
begin
 if not exists(select 1 from public.admin_memberships where user_id=p_staff and role='admin') then raise exception 'Admin required';end if;
 if p_status is null or p_status not in('approved','rejected','suspended','pending') then raise exception 'Invalid approval';end if;
 update private.broker_profiles set approval_status=p_status,approved_at=case when p_status='approved' then now() end,
 approved_by=p_staff,updated_at=now() where user_id=p_actor;
 if not found then raise exception 'Broker not found';end if;
 insert into public.admin_audit_log(actor_id,actor_kind,actor_source,table_name,record_id,operation,metadata)
 values(p_staff,'authenticated-admin','validated-admin-api','broker_profiles',p_actor::text,'ADMIN_ACTION',
 jsonb_build_object('operation','REVIEW','approvalStatus',p_status));
 return public.broker_context(p_actor);
end;$$;
create function public.broker_bind_customer(p_actor uuid,p_customer text,p_live boolean default null) returns text
 language plpgsql security definer set search_path=pg_catalog,private as $$
declare existing text;mode boolean;
begin
 if p_customer is null or p_customer !~ '^cus_[A-Za-z0-9]+$' then raise exception 'Invalid customer';end if;
 select stripe_customer_id into existing from private.broker_billing where user_id=p_actor for update;
 if not found then raise exception 'Broker registration required';end if;
 if existing is not null and existing<>p_customer then raise exception 'Customer binding is immutable';end if;
 select stripe_live_mode into mode from private.broker_config where singleton;
 if p_live is not null and p_live is distinct from mode then raise exception 'Billing configuration changed';end if;
 update private.broker_billing set stripe_customer_id=p_customer,customer_live_mode=mode where user_id=p_actor;
 return p_customer;
end;$$;
create function public.admin_reset_broker_test_billing(p_staff uuid,p_actor uuid,p_confirm boolean) returns jsonb
 language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare b private.broker_billing;
begin
 if p_confirm is distinct from true or not exists(select 1 from public.admin_memberships where user_id=p_staff and role='admin') then raise exception 'Explicit administrator reset required';end if;
 if (select billing_enabled from private.broker_config where singleton) then raise exception 'Disable billing before test reset';end if;
 select * into b from private.broker_billing where user_id=p_actor for update;
 if not found or b.customer_live_mode is distinct from false or b.verified_live_mode is true then raise exception 'Only test customer bindings may be reset';end if;
 if b.lease_until>now() then raise exception 'Billing lease in progress';end if;
 update private.broker_billing set stripe_customer_id=null,customer_live_mode=null,stripe_subscription_id=null,status='none',paid=false,
 current_period_end=null,cancel_at_period_end=false,blocked_reason=null,verified_price_id=null,verified_live_mode=null,
 checkout_url=null,checkout_expires_at=null,checkout_price_id=null,checkout_live_mode=null,lease_token=null,lease_until=null,updated_at=now()
 where user_id=p_actor;
 insert into public.admin_audit_log(actor_id,actor_kind,actor_source,table_name,record_id,operation,metadata)
 values(p_staff,'authenticated-admin','validated-admin-api','broker_billing',p_actor::text,'ADMIN_ACTION',jsonb_build_object('operation','RESET_TEST_BINDING'));
 return public.broker_context(p_actor);
end;$$;
create function public.broker_claim_payment_event(p_event text,p_type text,p_customer text)
 returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $$
declare b private.broker_billing;e private.broker_payment_events;token uuid:=gen_random_uuid();
begin
 select * into b from private.broker_billing where stripe_customer_id=p_customer for update;
 if not found then return jsonb_build_object('unknownCustomer',true);end if;
 select * into e from private.broker_payment_events where event_id=p_event;
 if found and e.user_id<>b.user_id then raise exception 'Event customer conflict';end if;
 if e.status='processed' then return jsonb_build_object('duplicate',true);end if;
 if b.lease_until>now() then return jsonb_build_object('busy',true);end if;
 insert into private.broker_payment_events(event_id,user_id,event_type,lease_token)
 values(p_event,b.user_id,p_type,token)
 on conflict(event_id) do update set lease_token=excluded.lease_token,event_type=excluded.event_type;
 update private.broker_billing set lease_token=token,lease_until=now()+interval '2 minutes' where user_id=b.user_id;
 return jsonb_build_object('userId',b.user_id,'leaseToken',token);
end;$$;
create function public.broker_finish_payment_event(p_event text,p_token uuid,p_state jsonb)
 returns boolean language plpgsql security definer set search_path=pg_catalog,private as $$
declare b private.broker_billing;e private.broker_payment_events;cfg private.broker_config;
begin
 select * into e from private.broker_payment_events where event_id=p_event;
 if not found or e.status<>'processing' or e.lease_token<>p_token then return false;end if;
 select * into b from private.broker_billing where user_id=e.user_id for update;
 if b.lease_token is distinct from p_token or b.lease_until<=now() then return false;end if;
 select * into cfg from private.broker_config where singleton;
 if not cfg.billing_enabled or p_state->>'priceId' is distinct from cfg.stripe_price_id
  or (p_state->>'liveMode')::boolean is distinct from cfg.stripe_live_mode then raise exception 'Billing configuration mismatch';end if;
 if p_state->>'status' is null or p_state->>'status' not in('none','incomplete','active','past_due','canceled','unpaid','paused') then raise exception 'Invalid billing status';end if;
 update private.broker_billing set stripe_subscription_id=nullif(p_state->>'subscriptionId',''),
  status=case when b.blocked_reason is not null or p_state->>'blockedReason' is not null then 'blocked' else p_state->>'status' end,
  paid=coalesce((p_state->>'paid')::boolean,false),current_period_end=nullif(p_state->>'currentPeriodEnd','')::timestamptz,
  cancel_at_period_end=coalesce((p_state->>'cancelAtPeriodEnd')::boolean,false),
  blocked_reason=coalesce(b.blocked_reason,p_state->>'blockedReason'),verified_price_id=p_state->>'priceId',verified_live_mode=(p_state->>'liveMode')::boolean,
  checkout_url=null,checkout_expires_at=null,lease_token=null,lease_until=null,updated_at=now()
 where user_id=b.user_id;
 update private.broker_payment_events set status='processed',processed_at=now() where event_id=p_event and lease_token=p_token;
 return true;
end;$$;
create function public.broker_fail_payment_event(p_event text,p_token uuid) returns void
 language plpgsql security definer set search_path=pg_catalog,private as $$
begin
 update private.broker_billing set lease_token=null,lease_until=null
 where lease_token=p_token and user_id=(select user_id from private.broker_payment_events where event_id=p_event and lease_token=p_token);
end;$$;

create function public.broker_save_listing(p_actor uuid,p_id uuid,p_fields jsonb,p_private jsonb,p_images jsonb)
 returns uuid language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare target uuid;cols text;payload jsonb;
begin
 if not public.broker_is_entitled(p_actor) then raise exception 'Paid broker access required';end if;
 if jsonb_typeof(p_fields) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_fields) k where k not in(
  'slug','title','description','transaction','type','price_thb','area_m2','land_area_m2','beds','baths','floor','built_year',
  'ownership','furnishing','status','zone','province','amenities','source_url','ownership_evidence','expires_at')) then raise exception 'Invalid broker property fields';end if;
 target:=coalesce(p_id,gen_random_uuid());
 if p_id is not null then
  perform 1 from private.broker_listings where property_id=p_id and user_id=p_actor for update;
  if not found then raise exception 'Own listing required';end if;
 end if;
 payload:=p_fields||jsonb_build_object('id',target,'published',false,'demo',false,'rights_status','pending');
 select string_agg(quote_ident(k),',' order by k) into cols from jsonb_object_keys(payload) k;
 if p_id is null then
  execute format('insert into public.properties(%1$s) select %1$s from jsonb_populate_record(null::public.properties,$1)',cols) using payload;
  insert into private.broker_listings(property_id,user_id) values(target,p_actor);
 else
  execute format('update public.properties set (%1$s)=(select %1$s from jsonb_populate_record(null::public.properties,$1)) where id=$2',cols) using payload,target;
  update private.broker_listings set review_status='draft',submitted_at=null where property_id=target and user_id=p_actor;
 end if;
 if p_private is not null then
  if jsonb_typeof(p_private) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_private) k where k not in('lat','lng')) then raise exception 'Private location consent requires staff review';end if;
  insert into public.property_private_locations(property_id,lat,lng,exact_publication_consent)
  values(target,(p_private->>'lat')::float,(p_private->>'lng')::float,false)
  on conflict(property_id) do update set lat=excluded.lat,lng=excluded.lng,exact_publication_consent=false,consent_evidence=null;
 end if;
 if p_images is not null then
  if jsonb_typeof(p_images) is distinct from 'array' or jsonb_array_length(p_images)>30 then raise exception 'Invalid gallery';end if;
  if exists(select 1 from jsonb_array_elements(p_images) i where i->>'rights_status' is distinct from 'pending') then raise exception 'Image review required';end if;
  perform public.reconcile_property_gallery(target,p_images);
 end if;
 return target;
end;$$;
create function public.broker_submit_listing(p_actor uuid,p_id uuid) returns boolean
 language plpgsql security definer set search_path=pg_catalog,public,private as $$
begin
 if not public.broker_is_entitled(p_actor) then raise exception 'Paid broker access required';end if;
 update private.broker_listings set review_status='submitted',submitted_at=now() where property_id=p_id and user_id=p_actor;
 if not found then raise exception 'Own listing required';end if;
 return true;
end;$$;
create function public.broker_listing_guard() returns trigger language plpgsql security definer set search_path=pg_catalog,private,public as $$
begin
 if tg_op='UPDATE' and exists(select 1 from private.broker_listings where property_id=new.id) and new.published then
  update private.broker_listings set review_status='approved' where property_id=new.id;
 end if;
 return new;
end;$$;
create trigger broker_listing_review after update on public.properties for each row execute function public.broker_listing_guard();

do $$declare fn regprocedure;begin
 for fn in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and (p.proname like 'broker_%' or p.proname in('admin_review_broker','admin_list_brokers','admin_reset_broker_test_billing')) loop
  execute format('revoke all on function %s from public,anon,authenticated',fn);
  if fn::text not like '%broker_listing_guard%' then execute format('grant execute on function %s to service_role',fn);end if;
 end loop;
end;$$;
commit;
