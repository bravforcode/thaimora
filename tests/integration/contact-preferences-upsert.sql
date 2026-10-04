-- Regression for actual 23514: INSERT checks precede ON CONFLICT UPDATE.
begin;
do $$declare actor uuid:='fefefefe-1111-4000-8000-000000000001';line_id text:='U'||repeat('c',32);result jsonb;begin
 if exists(select 1 from auth.users where id=actor) then raise exception 'Fixture already exists';end if;
 insert into auth.users(id,email,email_confirmed_at) values(actor,'contact-upsert@example.invalid',now());
 result:=public.contact_save_preferences(actor,'contact-upsert@example.invalid',true,false,'contact-relay-v1');
 if result->>'emailEnabled'<>'true' or result->>'lineEnabled'<>'false' then raise exception 'Fresh email preference not stored';end if;
 begin
  perform public.contact_save_preferences(actor,'contact-upsert@example.invalid',true,true,'contact-relay-v1');
  raise exception 'Unlinked LINE enabled';
 exception when raise_exception then if sqlerrm<>'Verified LINE link required' then raise;end if;end;
 perform public.contact_record_line_token(repeat('3',64),line_id);
 perform public.contact_prepare_line_link(actor,repeat('3',64),repeat('4',64));
 perform public.contact_apply_line_event('contact-upsert-link','accountLink',line_id,repeat('4',64),true);
 result:=public.contact_save_preferences(actor,'contact-upsert@example.invalid',true,true,'contact-relay-v1');
 if result->>'lineEnabled'<>'true' or result->>'emailEnabled'<>'true'
 or not exists(select 1 from private.contact_accounts where user_id=actor and line_user_id=line_id and line_verified_at is not null)
 then raise exception 'Linked LINE preference failed or binding lost';end if;
 result:=public.contact_save_preferences(actor,'contact-upsert@example.invalid',false,true,'contact-relay-v1');
 if result->>'lineEnabled'<>'true' or result->>'emailEnabled'<>'false' then raise exception 'LINE-only opt-in failed';end if;
 update auth.users set email_confirmed_at=null where id=actor;
 result:=public.contact_save_preferences(actor,'',false,false,null);
 if result->>'lineEnabled'<>'false' or result->>'emailEnabled'<>'false' then raise exception 'Withdrawal required renewed email proof';end if;
end;$$;
rollback;
