-- PostgreSQL checks proposed INSERT rows before ON CONFLICT selects the linked row.
-- Seed LINE safely off; enable it only on the existing verified account in UPDATE.
begin;
create or replace function public.contact_save_preferences(p_actor uuid,p_email text,p_email_enabled boolean,p_line_enabled boolean,p_version text)
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
 values(p_actor,p_email,now(),p_email_enabled,false,p_version,now())
 on conflict(user_id) do update set email=excluded.email,email_verified_at=now(),email_enabled=excluded.email_enabled,
 line_enabled=p_line_enabled,consent_version=case when p_email_enabled or p_line_enabled then excluded.consent_version else private.contact_accounts.consent_version end,
 consent_accepted_at=case when p_email_enabled or p_line_enabled then now() else private.contact_accounts.consent_accepted_at end,updated_at=now();
 update private.contact_outbox set status='canceled',last_error='recipient_opted_out',lease_token=null,lease_until=null
 where recipient_user_id=p_actor and status in('pending','failed','sending')
 and ((channel='email' and not p_email_enabled) or (channel='line' and not p_line_enabled));
 return public.contact_preferences(p_actor);
end;$$;
revoke all on function public.contact_save_preferences(uuid,text,boolean,boolean,text) from public,anon,authenticated;
grant execute on function public.contact_save_preferences(uuid,text,boolean,boolean,text) to service_role;
commit;
