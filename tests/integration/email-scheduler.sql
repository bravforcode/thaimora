begin;
do $$begin
 begin perform private.invoke_email_outbox();raise exception 'Missing scheduler config accepted';
 exception when others then if SQLERRM <> 'Email scheduler configuration missing or invalid' then raise;end if;end;
end $$;
insert into vault.decrypted_secrets values('thaimora_project_url','https://aaaaaaaaaaaaaaaaaaaa.supabase.co'),('thaimora_email_worker_secret',repeat('x',64));
select private.configure_email_outbox_scheduler('aaaaaaaaaaaaaaaaaaaa');
do $$begin
 if (select command from cron.job where jobname='thaimora-email-outbox-retry') is distinct from 'select private.invoke_email_outbox();' then raise exception 'Cron command contains unexpected data';end if;
 if (select schedule from cron.job where jobname='thaimora-email-outbox-retry') is distinct from '*/5 * * * *' then raise exception 'Wrong retry schedule';end if;
 if private.invoke_email_outbox() is not null or exists(select 1 from net.http_request_queue) then raise exception 'Empty outbox enqueued HTTP';end if;
end $$;
insert into properties(id,slug,title,description,transaction,type,price_thb,area_m2,ownership,furnishing,zone,province)
 values('22222222-2222-4222-8222-222222222222','scheduler-model','{"en":"Synthetic","th":"ทดสอบ"}','{}','sale','villa',1000000,100,'unknown','unfurnished','Phuket','Phuket');
insert into inquiries(id,property_id,name,email,country,message,idempotency_hash,payload_hash)
 values('33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222','Test','test@example.test','TH','Synthetic','scheduler-model','synthetic');
insert into email_outbox(inquiry_id,status,next_attempt_at) values('33333333-3333-4333-8333-333333333333','failed',now()+interval '1 hour');
do $$begin if private.invoke_email_outbox() is not null then raise exception 'Future retry enqueued early';end if;end $$;
update email_outbox set next_attempt_at=now() where inquiry_id='33333333-3333-4333-8333-333333333333';
do $$begin if private.invoke_email_outbox() is null then raise exception 'Due failure was not enqueued';end if;end $$;
delete from net.http_request_queue;
update email_outbox set status='sending',locked_at=now()-interval '11 minutes' where inquiry_id='33333333-3333-4333-8333-333333333333';
do $$begin
 if private.invoke_email_outbox() is null then raise exception 'Stale sending lock was not enqueued';end if;
 if (select timeout_milliseconds from net.http_request_queue limit 1) is distinct from 60000 then raise exception 'Worker deadline exceeds scheduler HTTP deadline';end if;
end $$;
update vault.decrypted_secrets set decrypted_secret='https://bbbbbbbbbbbbbbbbbbbb.supabase.co' where name='thaimora_project_url';
do $$begin
 begin perform private.invoke_email_outbox();raise exception 'Mismatched project accepted';
 exception when others then if SQLERRM <> 'Email scheduler configuration missing or invalid' then raise;end if;end;
end $$;
do $$declare checked_role text;begin
 foreach checked_role in array array['anon','authenticated','service_role'] loop
  if has_function_privilege(checked_role,'private.invoke_email_outbox()','EXECUTE')
   or has_function_privilege(checked_role,'private.configure_email_outbox_scheduler(text)','EXECUTE')
   or has_table_privilege(checked_role,'private.email_scheduler_config','SELECT') then
   raise exception 'Unprivileged scheduler access: %',checked_role;
  end if;
 end loop;
 if has_table_privilege('anon','net.http_request_queue','SELECT') or has_table_privilege('authenticated','net.http_request_queue','SELECT') then raise exception 'Queue credentials exposed';end if;
end $$;
select cron.schedule('other-job','0 0 * * *','select 1;');
select private.pause_email_outbox_scheduler();
do $$begin
 if exists(select 1 from cron.job where jobname='thaimora-email-outbox-retry') or not exists(select 1 from cron.job where jobname='other-job') then raise exception 'Pause changed wrong jobs';end if;
end $$;
rollback;
select 'PASS: scheduler SQL with synthetic interfaces; private roles, due/stale eligibility, fixed deadline, destination validation, scoped pause' as result;
