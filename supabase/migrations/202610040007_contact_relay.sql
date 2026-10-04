-- Inquiries notify only the listing's privately assigned, consenting recipient.
begin;
create table private.contact_config (
 singleton boolean primary key default true check(singleton),delivery_enabled boolean not null default false,
 consent_version text not null default 'contact-relay-v1'
);
insert into private.contact_config(singleton) values(true);
create table private.contact_accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 email text not null check(email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 email_verified_at timestamptz not null,
 email_enabled boolean not null default false,line_enabled boolean not null default false,
 line_user_id text unique check(line_user_id is null or line_user_id ~ '^U[0-9a-f]{32}$'),line_verified_at timestamptz,
 consent_version text,consent_accepted_at timestamptz,updated_at timestamptz not null default now(),
 check(not(email_enabled or line_enabled) or (consent_version is not null and consent_accepted_at is not null)),
 check(not line_enabled or (line_user_id is not null and line_verified_at is not null))
);
create table private.property_contact_recipients (
 property_id uuid primary key references public.properties(id) on delete cascade,
 recipient_user_id uuid not null references private.contact_accounts(user_id) on delete cascade,
 assigned_by uuid references auth.users(id),assigned_at timestamptz not null default now()
);
create table private.inquiry_recipients (
 inquiry_id uuid primary key references public.inquiries(id) on delete cascade,
 recipient_user_id uuid not null references private.contact_accounts(user_id) on delete cascade,
 consent_version text not null,consented_at timestamptz not null default now()
);
create index inquiry_recipients_owner on private.inquiry_recipients(recipient_user_id,inquiry_id);
create table private.contact_outbox (
 id uuid primary key default gen_random_uuid(),inquiry_id uuid not null references public.inquiries(id) on delete cascade,
 recipient_user_id uuid not null references private.contact_accounts(user_id) on delete cascade,
 channel text not null check(channel in('email','line')),
 recipient_target text not null,payload jsonb not null,
 status text not null default 'pending' check(status in('pending','sending','sent','failed','canceled')),
 attempts integer not null default 0,next_attempt_at timestamptz not null default now(),lease_token uuid,lease_until timestamptz,
 last_error text,sent_at timestamptz,created_at timestamptz not null default now(),
 unique(inquiry_id,recipient_user_id,channel)
);
create index contact_outbox_due on private.contact_outbox(next_attempt_at) where status in('pending','failed','sending');
create table private.line_account_links (
 token_hash text primary key,line_user_id text not null,nonce_hash text unique,user_id uuid references auth.users(id) on delete cascade,
 expires_at timestamptz not null default now()+interval '10 minutes',used_at timestamptz,
 check(token_hash ~ '^[0-9a-f]{64}$'),check(nonce_hash is null or nonce_hash ~ '^[0-9a-f]{64}$'),
 check(line_user_id ~ '^U[0-9a-f]{32}$')
);
create table private.line_webhook_events(event_id text primary key,created_at timestamptz not null default now());
do $$declare t text;begin
 foreach t in array array['contact_config','contact_accounts','property_contact_recipients','inquiry_recipients','contact_outbox','line_account_links','line_webhook_events'] loop
  execute format('alter table private.%I enable row level security',t);
  execute format('revoke all on private.%I from public,anon,authenticated',t);
  execute format('grant select,insert,update,delete on private.%I to service_role',t);
 end loop;
end;$$;
create function public.contact_preferences(p_actor uuid) returns jsonb language sql stable security definer set search_path=pg_catalog,private as $$
 select jsonb_build_object('emailEnabled',coalesce(a.email_enabled,false),'lineEnabled',coalesce(a.line_enabled,false),
 'lineLinked',a.line_verified_at is not null,'consentVersion',c.consent_version)
 from private.contact_config c left join private.contact_accounts a on a.user_id=p_actor where c.singleton;
$$;
create function public.contact_email_is_current(p_actor uuid,p_email text) returns boolean
 language sql stable security definer set search_path=pg_catalog,auth as $$
 select exists(select 1 from auth.users u where u.id=p_actor and u.email_confirmed_at is not null and lower(u.email)=lower(p_email));
$$;
create function public.contact_save_preferences(p_actor uuid,p_email text,p_email_enabled boolean,p_line_enabled boolean,p_version text)
 returns jsonb language plpgsql security definer set search_path=pg_catalog,private,public as $$
begin
 if p_email_enabled is false and p_line_enabled is false then
  update private.contact_accounts set email_enabled=false,line_enabled=false,updated_at=now() where user_id=p_actor;
  update private.contact_outbox set status='canceled',last_error='recipient_opted_out',lease_token=null,lease_until=null
  where recipient_user_id=p_actor and status in('pending','failed','sending');
  return public.contact_preferences(p_actor);
 end if;
 if not public.contact_email_is_current(p_actor,p_email) then raise exception 'Verified current email required';end if;
 if (p_email_enabled or p_line_enabled) and p_version is distinct from (select consent_version from private.contact_config where singleton) then raise exception 'Contact consent version required';end if;
 if p_email_enabled is null or p_line_enabled is null then raise exception 'Explicit channel choice required';end if;
 if p_line_enabled and not exists(select 1 from private.contact_accounts where user_id=p_actor and line_verified_at is not null) then raise exception 'Verified LINE link required';end if;
 insert into private.contact_accounts(user_id,email,email_verified_at,email_enabled,line_enabled,consent_version,consent_accepted_at)
 values(p_actor,p_email,now(),p_email_enabled,p_line_enabled,p_version,now())
 on conflict(user_id) do update set email=excluded.email,email_verified_at=now(),email_enabled=excluded.email_enabled,
 line_enabled=excluded.line_enabled,consent_version=case when p_email_enabled or p_line_enabled then excluded.consent_version else private.contact_accounts.consent_version end,
 consent_accepted_at=case when p_email_enabled or p_line_enabled then now() else private.contact_accounts.consent_accepted_at end,updated_at=now();
 update private.contact_outbox set status='canceled',last_error='recipient_opted_out',lease_token=null,lease_until=null
 where recipient_user_id=p_actor and status in('pending','failed','sending')
 and ((channel='email' and not p_email_enabled) or (channel='line' and not p_line_enabled));
 return public.contact_preferences(p_actor);
end;$$;
create function public.contact_ensure_account(p_actor uuid,p_email text) returns void
 language plpgsql security definer set search_path=pg_catalog,private,public as $$
begin
 if not public.contact_email_is_current(p_actor,p_email) then raise exception 'Verified current email required';end if;
 insert into private.contact_accounts(user_id,email,email_verified_at) values(p_actor,p_email,now())
 on conflict(user_id) do update set email=excluded.email,email_verified_at=now(),updated_at=now();
end;$$;
create function public.admin_assign_contact(p_staff uuid,p_property uuid,p_recipient uuid) returns jsonb
 language plpgsql security definer set search_path=pg_catalog,private,public as $$
begin
 if not exists(select 1 from public.admin_memberships where user_id=p_staff) then raise exception 'Admin required';end if;
 if not exists(select 1 from private.contact_accounts where user_id=p_recipient) then raise exception 'Verified recipient account required';end if;
 insert into private.property_contact_recipients(property_id,recipient_user_id,assigned_by)
 values(p_property,p_recipient,p_staff)
 on conflict(property_id) do update set recipient_user_id=excluded.recipient_user_id,assigned_by=p_staff,assigned_at=now();
 update private.contact_outbox o set status='canceled',last_error='recipient_assignment_changed',lease_token=null,lease_until=null
 where o.status in('pending','failed','sending') and o.recipient_user_id<>p_recipient
 and o.inquiry_id in(select id from public.inquiries where property_id=p_property);
 insert into public.admin_audit_log(actor_id,actor_kind,actor_source,table_name,record_id,operation,metadata)
 values(p_staff,'authenticated-admin','validated-admin-api','property_contact_recipients',p_property::text,'ADMIN_ACTION',jsonb_build_object('operation','ASSIGN_RECIPIENT'));
 return public.contact_property_assignment(p_property);
end;$$;
create function public.contact_property_assignment(p_property uuid) returns jsonb
 language sql stable security definer set search_path=pg_catalog,private as $$
 select coalesce((select jsonb_build_object('recipientUserId',a.user_id,'emailEnabled',a.email_enabled,'lineEnabled',a.line_enabled,
 'lineLinked',a.line_verified_at is not null) from private.property_contact_recipients r
 join private.contact_accounts a on a.user_id=r.recipient_user_id where r.property_id=p_property),
 jsonb_build_object('recipientUserId',null,'emailEnabled',false,'lineEnabled',false,'lineLinked',false));
$$;
create function public.contact_broker_listing_assignment() returns trigger
 language plpgsql security definer set search_path=pg_catalog,private as $$
begin
 insert into private.property_contact_recipients(property_id,recipient_user_id)
 select new.property_id,new.user_id where exists(select 1 from private.contact_accounts where user_id=new.user_id)
 on conflict(property_id) do nothing;
 return new;
end;$$;
create trigger contact_broker_listing_assignment after insert on private.broker_listings for each row execute function public.contact_broker_listing_assignment();
create function public.submit_contact_inquiry(p_property uuid,p_name text,p_email text,p_country text,p_message text,p_key text,p_payload text,p_share boolean)
 returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare result jsonb;recipient private.contact_accounts;iid uuid;queued integer:=0;version text;
begin
 if p_share is distinct from true then raise exception 'Visitor contact sharing consent required';end if;
 if not public.property_is_public(p_property) then raise exception 'Property unavailable';end if;
 result:=public.submit_inquiry(p_property,p_name,p_email,p_country,p_message,p_key,p_payload);iid:=(result->>'id')::uuid;
 if (result->>'duplicate')::boolean then
  return result||jsonb_build_object('contactStatus',case when exists(select 1 from private.contact_outbox where inquiry_id=iid) then 'queued' else 'unavailable' end);
 end if;
 select a.* into recipient from private.contact_accounts a join private.property_contact_recipients r on r.recipient_user_id=a.user_id
 where r.property_id=p_property;
 select consent_version into version from private.contact_config where singleton;
 if found and recipient.user_id is not null then
  insert into private.inquiry_recipients(inquiry_id,recipient_user_id,consent_version) values(iid,recipient.user_id,version);
  insert into private.contact_outbox(inquiry_id,recipient_user_id,channel,recipient_target,payload)
  select iid,recipient.user_id,ch,case when ch='email' then recipient.email else recipient.line_user_id end,
  jsonb_build_object('inquiryId',iid,'propertyId',p_property,'name',p_name,'email',p_email,'country',p_country,'message',p_message)
  from (values('email'),('line')) channels(ch)
  where recipient.consent_version=version and recipient.consent_accepted_at is not null
  and ((ch='email' and recipient.email_enabled and public.contact_email_is_current(recipient.user_id,recipient.email)) or (ch='line' and recipient.line_enabled and recipient.line_verified_at is not null));
  get diagnostics queued=row_count;
 end if;
 return result||jsonb_build_object('contactStatus',case when queued>0 then 'queued' else 'unavailable' end);
end;$$;
create function public.broker_read_leads(p_actor uuid,p_id uuid default null) returns jsonb
 language plpgsql stable security definer set search_path=pg_catalog,private,public as $$
declare result jsonb;
begin
 if not public.broker_is_entitled(p_actor) then raise exception 'Paid broker access required';end if;
 if (select count(*) from private.inquiry_recipients where recipient_user_id=p_actor and(p_id is null or inquiry_id=p_id))>1000 then raise exception 'Broker record page required';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'propertyId',i.property_id,'name',i.name,'email',i.email,'country',i.country,
 'message',i.message,'status',i.status,'createdAt',i.created_at) order by i.created_at desc),'[]'::jsonb) into result
 from public.inquiries i join private.inquiry_recipients r on r.inquiry_id=i.id
 join private.broker_listings l on l.property_id=i.property_id and l.user_id=p_actor
 where r.recipient_user_id=p_actor and (p_id is null or i.id=p_id);
 return result;
end;$$;
create function public.broker_update_lead(p_actor uuid,p_id uuid,p_status text) returns jsonb
 language plpgsql security definer set search_path=pg_catalog,private,public as $$
begin
 if not public.broker_is_entitled(p_actor) then raise exception 'Paid broker access required';end if;
 if p_status is null or p_status not in('new','contacted','closed') then raise exception 'Invalid lead status';end if;
 update public.inquiries i set status=p_status where i.id=p_id
 and exists(select 1 from private.inquiry_recipients r join private.broker_listings l on l.property_id=i.property_id
 where r.inquiry_id=i.id and r.recipient_user_id=p_actor and l.user_id=p_actor);
 if not found then raise exception 'Own lead required';end if;
 return public.broker_read_leads(p_actor,p_id)->0;
end;$$;
create function public.contact_claim_batch(p_limit integer default 5,p_channels text[] default array['email','line']::text[]) returns jsonb
 language plpgsql security definer set search_path=pg_catalog,private as $$
declare result jsonb;
begin
 if not (select delivery_enabled from private.contact_config where singleton) then return '[]'::jsonb;end if;
 update private.contact_outbox set status='canceled',last_error='delivery_window_expired',lease_token=null,lease_until=null
 where status in('pending','failed','sending') and (created_at<=now()-interval '23 hours' or attempts>=10);
 with claimed as(update private.contact_outbox set status='sending',attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes'
 where id in(select id from private.contact_outbox where channel=any(p_channels) and attempts<10 and ((status in('pending','failed') and next_attempt_at<=now())
 or(status='sending' and lease_until<=now())) order by created_at for update skip locked limit least(greatest(p_limit,0),5))
 returning id,lease_token,attempts,channel)
 select coalesce(jsonb_agg(to_jsonb(claimed)),'[]'::jsonb) into result from claimed;
 return result;
end;$$;
create function public.contact_delivery_payload(p_id uuid,p_token uuid) returns jsonb
 language plpgsql security definer set search_path=pg_catalog,private,public as $$
declare result jsonb;
begin
 select o.payload||jsonb_build_object('channel',o.channel,'recipient',o.recipient_target)
 into result from private.contact_outbox o join public.inquiries i on i.id=o.inquiry_id
 join private.contact_accounts a on a.user_id=o.recipient_user_id
 join private.property_contact_recipients r on r.property_id=i.property_id and r.recipient_user_id=a.user_id
 join private.inquiry_recipients ir on ir.inquiry_id=i.id and ir.recipient_user_id=a.user_id
 cross join private.contact_config cfg
 where cfg.singleton and cfg.delivery_enabled and o.id=p_id and o.status='sending' and o.lease_token=p_token and o.lease_until>now()
 and o.created_at>now()-interval '23 hours'
 and o.recipient_target=case when o.channel='email' then a.email else a.line_user_id end
 and public.property_is_public(i.property_id) and a.consent_version=cfg.consent_version and a.consent_accepted_at is not null
 and ((o.channel='email' and a.email_enabled and public.contact_email_is_current(a.user_id,a.email)) or(o.channel='line' and a.line_enabled and a.line_verified_at is not null));
 if result is null then
  update private.contact_outbox set status='canceled',last_error='recipient_unavailable',lease_token=null,lease_until=null
  where id=p_id and lease_token=p_token and status='sending';
 end if;
 return result;
end;$$;
create function public.contact_finish_delivery(p_id uuid,p_token uuid,p_sent boolean) returns boolean
 language plpgsql security definer set search_path=pg_catalog,private as $$
begin
 update private.contact_outbox set status=case when p_sent then 'sent' else 'failed' end,
 sent_at=case when p_sent then now() end,last_error=case when p_sent then null else 'provider_unavailable' end,
 next_attempt_at=now()+least(interval '1 day',interval '1 minute'*power(2,least(attempts,10))),lease_token=null,lease_until=null
 where id=p_id and status='sending' and lease_token=p_token and lease_until>now();
 return found;
end;$$;
create function public.contact_unlink_line(p_actor uuid) returns jsonb
 language plpgsql security definer set search_path=pg_catalog,private,public as $$
begin
 update private.contact_accounts set line_enabled=false,line_user_id=null,line_verified_at=null,updated_at=now() where user_id=p_actor;
 delete from private.line_account_links where user_id=p_actor;
 update private.contact_outbox set status='canceled',last_error='recipient_opted_out',lease_token=null,lease_until=null
 where recipient_user_id=p_actor and channel='line' and status in('pending','failed','sending');
 return public.contact_preferences(p_actor);
end;$$;
create function public.contact_record_line_token(p_hash text,p_line_user text) returns void
 language plpgsql security definer set search_path=pg_catalog,private as $$
begin
 delete from private.line_account_links where expires_at<now()-interval '1 day';
 insert into private.line_account_links(token_hash,line_user_id) values(p_hash,p_line_user) on conflict(token_hash) do nothing;
end;$$;
create function public.contact_line_event_seen(p_event text) returns boolean
 language sql stable security definer set search_path=pg_catalog,private as $$
 select exists(select 1 from private.line_webhook_events where event_id=p_event);
$$;
create function public.contact_prepare_line_link(p_actor uuid,p_token_hash text,p_nonce_hash text) returns boolean
 language plpgsql security definer set search_path=pg_catalog,private as $$
begin
 if not exists(select 1 from private.contact_accounts where user_id=p_actor) then raise exception 'Verified account required';end if;
 update private.line_account_links set user_id=p_actor,nonce_hash=p_nonce_hash
 where token_hash=p_token_hash and expires_at>now() and used_at is null and nonce_hash is null;
 return found;
end;$$;
create function public.contact_apply_line_event(p_event text,p_type text,p_line_user text,p_nonce_hash text default null,p_success boolean default false)
 returns boolean language plpgsql security definer set search_path=pg_catalog,private as $$
declare target uuid;
begin
 if p_event is null or length(p_event)>200 or p_line_user !~ '^U[0-9a-f]{32}$' then raise exception 'Invalid LINE event';end if;
 insert into private.line_webhook_events(event_id) values(p_event) on conflict(event_id) do nothing;
 if not found then return false;end if;
 delete from private.line_webhook_events where created_at<now()-interval '30 days';
 if p_type='accountLink' and p_success then
  update private.line_account_links set used_at=now() where nonce_hash=p_nonce_hash and line_user_id=p_line_user
  and user_id is not null and expires_at>now() and used_at is null returning user_id into target;
  if target is null then return false;end if;
  update private.contact_accounts set line_user_id=p_line_user,line_verified_at=now(),line_enabled=false,updated_at=now() where user_id=target;
 elsif p_type='unfollow' then
  update private.contact_accounts set line_enabled=false,line_verified_at=null,updated_at=now() where line_user_id=p_line_user;
  update private.contact_outbox set status='canceled',last_error='recipient_opted_out',lease_token=null,lease_until=null
  where channel='line' and status in('pending','failed','sending') and recipient_user_id in(select user_id from private.contact_accounts where line_user_id=p_line_user);
 end if;
 return true;
end;$$;
do $$declare fn regprocedure;begin
 for fn in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and (p.proname like 'contact_%' or p.proname in('submit_contact_inquiry','admin_assign_contact','broker_read_leads','broker_update_lead')) loop
  execute format('revoke all on function %s from public,anon,authenticated',fn);
  if fn::text not like '%contact_broker_listing_assignment%' then execute format('grant execute on function %s to service_role',fn);end if;
 end loop;
end;$$;
commit;
