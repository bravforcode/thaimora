-- Safe on the hosted database: all named fixtures/configuration changes roll back.
begin;
do $$declare f text;begin
 foreach f in array array['claim_content_sources(integer)','finish_content_source(text,uuid,text,timestamptz,jsonb,jsonb,integer,text,boolean)','fail_content_source(text,uuid,text)','configure_content_scheduler(text,text)','admin_release_content_override(text,text,uuid)','consume_content_sync_nonce(uuid,bigint)'] loop
  if has_function_privilege('anon','public.'||f,'EXECUTE') or has_function_privilege('authenticated','public.'||f,'EXECUTE') then raise exception 'Private content RPC exposed: %',f;end if;
 end loop;
 if has_schema_privilege('anon','private','USAGE') or has_schema_privilege('authenticated','private','USAGE') then raise exception 'Private registry schema exposed';end if;
 if exists(select 1 from public.events where id like 'organizer-json:automation-%') then raise exception 'Test fixture ID collision';end if;
end$$;
do $$declare nonce uuid:=gen_random_uuid();stamp bigint:=floor(extract(epoch from clock_timestamp()))::bigint;begin
 if not public.consume_content_sync_nonce(nonce,stamp) or public.consume_content_sync_nonce(nonce,stamp) then raise exception 'Signed scheduler nonce replay admitted';end if;
 if public.consume_content_sync_nonce(gen_random_uuid(),stamp-61) or public.consume_content_sync_nonce(gen_random_uuid(),stamp+11) or public.consume_content_sync_nonce(null,stamp) or public.consume_content_sync_nonce(gen_random_uuid(),null) then raise exception 'Stale/future/null nonce admitted';end if;
 if position('Authorization' in pg_get_functiondef('private.invoke_content_sync()'::regprocedure))>0 then raise exception 'Scheduler queues permanent bearer';end if;
end$$;
insert into public.events(id,name,description,starts_at,ends_at,location,source,source_url,license,rights_status,published,demo)
values('organizer-json:automation-expired','{"en":"Expired fixture","th":"Fixture"}','{}',now()-interval '2 hours',now()-interval '1 hour','{"lat":8,"lng":98.5}','fixture','https://organizer.example/','Reviewed fixture license','approved',true,false);
set local role anon;
do $$begin
 if public.content_is_public('events','organizer-json:automation-expired') or exists(select 1 from public.public_events where id='organizer-json:automation-expired') or exists(select 1 from public.events where id='organizer-json:automation-expired') then raise exception 'Expired event leaked through anonymous views/table';end if;
 if jsonb_typeof(public.public_content_meta()->'revision')<>'string' or jsonb_typeof(public.public_content_meta()->'eventsVersion')<>'string' then raise exception 'Revision contract invalid';end if;
end$$;
reset role;
do $$begin if not exists(select 1 from public.events where id='organizer-json:automation-expired' and published) then raise exception 'Expiry destroyed administrative event history';end if;end$$;
update private.content_sources set enabled=false;
update private.content_sources set enabled=true,endpoint='https://organizer.example/feed.json',public_source_url='https://organizer.example/',license='Reviewed fixture license',rights_evidence='Rolled-back fixture permission',rights_confirmed=true,bbox='[98,7,99,9]',next_due_at=now(),lease_token=null,lease_until=null where id='organizer-json';
do $$declare claim jsonb;lease uuid;batch jsonb;result jsonb;v text;begin
 begin perform public.finish_content_source('organizer-json',null,'unclaimed-fixture',null);raise exception 'Expected unclaimed NULL lease rejection';exception when others then if SQLERRM='Expected unclaimed NULL lease rejection' then raise;end if;end;
 if public.fail_content_source('organizer-json',null,'invalid_source') then raise exception 'Unclaimed NULL lease failure admitted';end if;
 select x into claim from public.claim_content_sources(2) x;
 lease:=(claim->>'lease')::uuid;
 if claim->>'id'<>'organizer-json' or lease is null then raise exception 'Due source not leased';end if;
 if exists(select 1 from public.claim_content_sources(2)) then raise exception 'Unexpired lease was claimed twice';end if;
 begin perform public.finish_content_source('organizer-json',gen_random_uuid(),'fixture',null);raise exception 'Expected stale lease rejection';exception when others then if SQLERRM='Expected stale lease rejection' then raise;end if;end;
 batch:=jsonb_build_array(jsonb_build_object('id','organizer-json:automation-a','name','{"en":"Original fixture","th":"Fixture"}'::jsonb,'description','{}'::jsonb,'location','{"lat":8,"lng":98.5}'::jsonb,'starts_at',now()+interval '1 day','ends_at',now()+interval '2 days','admin_override',true,'rights_evidence','Untrusted source proof'));
 select public.public_content_meta()->>'eventsVersion' into v;
 begin perform public.finish_content_source('organizer-json',lease,'incomplete-fixture',null,batch,null,1);raise exception 'Expected incomplete snapshot rejection';exception when others then if SQLERRM='Expected incomplete snapshot rejection' then raise;end if;end;
 result:=public.finish_content_source('organizer-json',lease,'fixture-v1',null,batch,null,1,null,true);
 if result->>'written'<>'1' or not public.content_is_public('events','organizer-json:automation-a') then raise exception 'Reviewed new event not admitted';end if;
 if exists(select 1 from public.events where id='organizer-json:automation-a' and (admin_override or rights_evidence='Untrusted source proof')) then raise exception 'Source privilege fields admitted';end if;
 if public.public_content_meta()->>'eventsVersion'=v then raise exception 'Event changes failed to invalidate revision';end if;
 update public.events set admin_override=true,name='{"en":"Admin fixture","th":"Fixture"}' where id='organizer-json:automation-a';
 update private.content_sources set next_due_at=now() where id='organizer-json';select x into claim from public.claim_content_sources(2) x;lease:=(claim->>'lease')::uuid;
 result:=public.finish_content_source('organizer-json',lease,'fixture-v2',null,batch,null,1,null,true);
 if result->>'skipped'<>'1' or not exists(select 1 from public.events where id='organizer-json:automation-a' and name->>'en'='Admin fixture' and admin_override) then raise exception 'Atomic sync overwrote admin changes';end if;
 update private.content_sources set next_due_at=now() where id='organizer-json';select x into claim from public.claim_content_sources(2) x;lease:=(claim->>'lease')::uuid;
 perform public.finish_content_source('organizer-json',lease,'fixture-admin-empty',null,'[]',null,0,null,true);
 if not exists(select 1 from public.events where id='organizer-json:automation-a' and published and admin_override) then raise exception 'Complete snapshot overwrote protected admin publication';end if;
 update public.events set admin_override=false where id='organizer-json:automation-a';
 update private.content_sources set next_due_at=now() where id='organizer-json';select x into claim from public.claim_content_sources(2) x;lease:=(claim->>'lease')::uuid;
 perform public.finish_content_source('organizer-json',lease,'fixture-empty',null,'[]',null,0,null,true);
 if not exists(select 1 from public.events where id='organizer-json:automation-a' and not published) or public.content_is_public('events','organizer-json:automation-a') then raise exception 'Complete empty snapshot failed to withdraw event';end if;
 update private.content_sources set next_due_at=now() where id='organizer-json';select x into claim from public.claim_content_sources(2) x;lease:=(claim->>'lease')::uuid;
 perform public.finish_content_source('organizer-json',lease,'fixture-reappeared',null,batch,null,1,null,true);
 if not public.content_is_public('events','organizer-json:automation-a') then raise exception 'Approved source-owned reappearance was not restored';end if;
 update private.content_sources set license='Changed fixture license',next_due_at=now() where id='organizer-json';select x into claim from public.claim_content_sources(2) x;lease:=(claim->>'lease')::uuid;
 perform public.finish_content_source('organizer-json',lease,'fixture-v3',null,batch,null,1,null,true);
 if not exists(select 1 from public.events where id='organizer-json:automation-a' and rights_status='pending' and not published and rights_evidence is null) then raise exception 'Changed source license inherited old approval';end if;
 update public.events set rights_status='rejected',published=false where id='organizer-json:automation-a';
 update private.content_sources set next_due_at=now() where id='organizer-json';select x into claim from public.claim_content_sources(2) x;lease:=(claim->>'lease')::uuid;
 result:=public.finish_content_source('organizer-json',lease,'fixture-v4',null,batch,null,1,null,true);
 if result->>'skipped'<>'1' then raise exception 'Rejected record was overwritten';end if;
 delete from public.events where id='organizer-json:automation-a';
 update private.content_sources set next_due_at=now() where id='organizer-json';select x into claim from public.claim_content_sources(2) x;lease:=(claim->>'lease')::uuid;
 result:=public.finish_content_source('organizer-json',lease,'fixture-v5',null,batch,null,1,null,true);
 if result->>'skipped'<>'1' or exists(select 1 from public.events where id='organizer-json:automation-a') then raise exception 'Deleted admin record resurrected';end if;
 update private.content_sources set next_due_at=now() where id='organizer-json';select x into claim from public.claim_content_sources(2) x;lease:=(claim->>'lease')::uuid;
 if not public.fail_content_source('organizer-json',lease,'https://secret.example/private') then raise exception 'Failure not recorded';end if;
 if not exists(select 1 from private.content_sources where id='organizer-json' and status='error' and error_code='invalid_source' and failures=1 and next_due_at>=now()+interval '5 minutes' and source_version='fixture-v5') then raise exception 'Failure lost prior good version or unbounded error';end if;
 update private.content_sources set interval_seconds=300,next_due_at=now() where id='organizer-json';select x into claim from public.claim_content_sources(2) x;lease:=(claim->>'lease')::uuid;
 perform public.fail_content_source('organizer-json',lease,'upstream_unavailable');
 if not exists(select 1 from private.content_sources where id='organizer-json' and failures=2 and next_due_at>=now()+interval '10 minutes') then raise exception 'Short source interval defeated failure backoff';end if;
end$$;
do $$declare actor uuid:=gen_random_uuid();result jsonb;begin
 begin perform public.admin_release_content_override('events','organizer-json:automation-expired',null);raise exception 'Expected admin actor rejection';exception when others then if SQLERRM='Expected admin actor rejection' then raise;end if;end;
 insert into auth.users(id,email) values(actor,actor::text||'@invalid.example');
 insert into public.admin_memberships(user_id,role) values(actor,'admin');
 update public.events set published=false,rights_status='pending',admin_override=true where id='organizer-json:automation-expired';
 result:=public.admin_release_content_override('events','organizer-json:automation-expired',actor);
 if result->>'automaticSyncEnabled'<>'true' or not exists(select 1 from public.events where id='organizer-json:automation-expired' and not admin_override and rights_status='pending' and not published) then raise exception 'Admin release changed publication approval';end if;
 if not exists(select 1 from public.admin_audit_log where actor_id=actor and table_name='events' and record_id='organizer-json:automation-expired' and metadata->>'automaticSyncEnabled'='true') then raise exception 'Admin release audit missing';end if;
 begin perform public.admin_release_content_override('events','organizer-json:automation-missing',actor);raise exception 'Expected nonexistent content rejection';exception when others then if SQLERRM='Expected nonexistent content rejection' then raise;end if;end;
 begin perform public.admin_release_content_override('properties','organizer-json:automation-expired',actor);raise exception 'Expected noncontent table rejection';exception when others then if SQLERRM='Expected noncontent table rejection' then raise;end if;end;
end$$;
rollback;
