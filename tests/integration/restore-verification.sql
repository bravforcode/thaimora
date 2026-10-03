begin;
insert into auth.users(id)values('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
insert into admin_memberships(user_id,role)values('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','admin');
insert into property_images(property_id,url,alt,rights_status,rights_evidence)
values('99999999-9999-9999-9999-999999999999','https://example.test/backup.jpg','{"en":"Fixture","th":"ทดสอบ"}','approved','synthetic rights proof');
update properties set published=true where id='99999999-9999-9999-9999-999999999999';
set local role anon;
do $$begin
 if(select count(*)from public_properties)<>1 then raise exception 'Restored anonymous browsing/grants failed';end if;
 if(select count(*)from search_properties_v2('{"sort":"newest","limit":30}'::jsonb))<>1 then raise exception 'Restored search function grants failed';end if;
 begin perform * from property_private_locations;raise exception 'Restored private-coordinate leak';exception when insufficient_privilege then null;end;
 begin perform ownership_evidence from properties;raise exception 'Restored evidence leak';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',true);
do $$begin if(select count(*)from property_private_locations)<>1 then raise exception 'Restored admin access failed';end if;end $$;
reset role;
set local role service_role;
select submit_inquiry('99999999-9999-9999-9999-999999999999','Synthetic backup test','backup@example.test','TH','Restoration fixture only','backup-test-key','backup-test-payload');
do $$begin if(select count(*)from inquiries)<>1 or(select count(*)from email_outbox)<>1 then raise exception 'Restored inquiry duplicate/outbox failure';end if;end $$;
reset role;
rollback;
select 'PASS: decrypted restore retains anonymous column/view/search grants, private RLS, admin access, inquiry/outbox idempotency' as result;
