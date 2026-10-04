import {ApiError} from '../../supabase/functions/_shared/domain.ts';
import {contactMessage,contactRoute,contactWorkerSignature,handleLineEvents,lineSignature,runContactDelivery} from '../../supabase/functions/_shared/contact-relay.ts';
import type {BrokerDb} from '../../supabase/functions/_shared/broker-api.ts';
import type {ObjectValue} from '../../supabase/functions/_shared/broker-billing.ts';
function equal(a:unknown,b:unknown){if(JSON.stringify(a)!==JSON.stringify(b))throw new Error('Mismatch '+JSON.stringify(a)+' vs '+JSON.stringify(b));}
function rpcFake(run:(name:string,args:ObjectValue)=>unknown):(name:string,args:ObjectValue)=>Promise<unknown> {return(name,args)=>Promise.resolve().then(()=>run(name,args));}
function fetchFake(run:(input:RequestInfo|URL,init?:RequestInit)=>Response):typeof fetch {return(input,init)=>Promise.resolve().then(()=>run(input,init));}
const id='00000000-0000-0000-0000-000000000001',lease='00000000-0000-0000-0000-000000000002',line='U'+'a'.repeat(32);
const payload={inquiryId:id,propertyId:id,name:'Visitor fixture',email:'visitor@example.invalid',country:'TH',message:'Please contact me about this exact property.'};
async function signature(message:string,secret:string,hex=false):Promise<string>{const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const b=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(message)));return hex?Array.from(b,v=>v.toString(16).padStart(2,'0')).join(''):btoa(String.fromCharCode(...b));}
Deno.test('LINE webhook signature binds exact raw body and rejects forged content',async()=>{
 const raw='{"events":[],"note":"ทดสอบ"}',secret='offline-line-secret',sig=await signature(raw,secret);
 equal(await lineSignature(raw,sig,secret),true);equal(await lineSignature(raw+' ',sig,secret),false);equal(await lineSignature(raw,sig,'wrong'),false);
});
Deno.test('email exact recipient and visitor reply-to use plain text with stable outbox idempotency',async()=>{
 let request:ObjectValue={};const updates:unknown[]=[];
 const result=await runContactDelivery({emailKey:'fixture-email-key',emailFrom:'Site <site@example.invalid>',lineToken:'',
  rpc:rpcFake((name,args)=>{if(name==='contact_claim_batch'){equal(args.p_channels,['email']);return [{id,lease_token:lease,channel:'email'}];}if(name==='contact_delivery_payload')return {...payload,channel:'email',recipient:'owner@example.invalid'};updates.push(args);return true;}),
  fetcher:fetchFake((url,init)=>{equal(url,'https://api.resend.com/emails');const headers=new Headers(init?.headers);equal(headers.get('Idempotency-Key'),'contact-'+id);request=JSON.parse(String(init?.body));return new Response('{}',{status:200});})});
 equal(request.to,['owner@example.invalid']);equal(request.reply_to,'visitor@example.invalid');equal(request.text,contactMessage(payload));equal('html' in request,false);equal(result,{sent:1,failed:0,canceled:0});equal((updates[0] as ObjectValue).p_sent,true);
});
Deno.test('recipient opt-out, deletion, reassignment, consent or address change cancels without provider call',async()=>{
 let called=false;const result=await runContactDelivery({emailKey:'fixture',emailFrom:'site@example.invalid',lineToken:'',rpc:rpcFake(name=>name==='contact_claim_batch'?[{id,lease_token:lease}]:null),fetcher:fetchFake(()=>{called=true;throw new Error('Must not call provider');})});
 equal(called,false);equal(result,{sent:0,failed:0,canceled:1});
});
Deno.test('LINE uses bound verified UID and UUID retry key; 409 needs accepted-request evidence',async()=>{
 for(const acceptedHeader of [false,true]){
  const result=await runContactDelivery({emailKey:'',emailFrom:'',lineToken:'fixture-line-token',rpc:rpcFake(name=>name==='contact_claim_batch'?[{id,lease_token:lease,channel:'line'}]:name==='contact_delivery_payload'?{...payload,channel:'line',recipient:line}:true),
   fetcher:fetchFake((url,init)=>{equal(url,'https://api.line.me/v2/bot/message/push');equal(new Headers(init?.headers).get('X-Line-Retry-Key'),id);equal(JSON.parse(String(init?.body)).to,line);return new Response('{}',{status:409,headers:acceptedHeader?{'x-line-accepted-request-id':'previous-accepted'}:{}});})});
  equal(result,acceptedHeader?{sent:1,failed:0,canceled:0}:{sent:0,failed:1,canceled:0});
 }
});
Deno.test('provider timeout keeps retryable fixed error and does not lose queued inquiry',async()=>{
 const states:ObjectValue[]=[];const result=await runContactDelivery({emailKey:'fixture',emailFrom:'site@example.invalid',lineToken:'',rpc:rpcFake((name,args)=>{if(name==='contact_claim_batch')return [{id,lease_token:lease}];if(name==='contact_delivery_payload')return {...payload,channel:'email',recipient:'owner@example.invalid'};states.push(args);return true;}),fetcher:fetchFake(()=>{throw new Error('secret-provider-message');})});
 equal(result,{sent:0,failed:1,canceled:0});equal(states[0],{p_id:id,p_token:lease,p_sent:false});
});
Deno.test('malformed or arbitrary LINE destination never reaches provider',async()=>{
 let called=false;const result=await runContactDelivery({emailKey:'',emailFrom:'',lineToken:'fixture',rpc:rpcFake(name=>name==='contact_claim_batch'?[{id,lease_token:lease}]:name==='contact_delivery_payload'?{...payload,channel:'line',recipient:'https://attacker.example.org'}:true),fetcher:fetchFake(()=>{called=true;return new Response('{}');})});equal(called,false);equal(result.failed,1);
});
Deno.test('contact withdrawal and LINE unlink remain available without broker paid entitlement',async()=>{
 const calls:string[]=[];const db={rpc:(name:string)=>{calls.push(name);return Promise.resolve({data:{emailEnabled:false,lineEnabled:false,lineLinked:false},error:null});},auth:{getUser:()=>Promise.resolve({data:{user:{id,email:null,email_confirmed_at:null}},error:null})}} as unknown as BrokerDb;
 const headers={Authorization:'Bearer offline-validated-user','Content-Type':'application/json'};
 const disabled=await contactRoute(new Request('https://api.example.org',{method:'PATCH',headers,body:JSON.stringify({emailEnabled:false,lineEnabled:false,consentAccepted:false})}),['contact','preferences'],db);equal(disabled?.status,200);
 const unlinked=await contactRoute(new Request('https://api.example.org',{method:'DELETE',headers}),['contact','line-link'],db);equal(unlinked?.status,200);equal(calls,['contact_save_preferences','contact_unlink_line']);
});
Deno.test('contact activation requires explicit recorded consent and rejects unlinked LINE',async()=>{
 const db={rpc:()=>{throw new Error('No SQL write expected');},auth:{getUser:()=>Promise.resolve({data:{user:{id,email:'owner@example.invalid',email_confirmed_at:'date'}},error:null})}} as unknown as BrokerDb;
 try{await contactRoute(new Request('https://api.example.org',{method:'PATCH',headers:{Authorization:'Bearer fixture'},body:JSON.stringify({emailEnabled:true,lineEnabled:false,consentAccepted:false})}),['contact','preferences'],db);}catch(error){if(error instanceof ApiError&&error.code==='recipient_contact_consent_required')return;throw error;}throw new Error('Consent accepted without explicit action');
});
Deno.test('official accountLink nonce goes through signed private event; group events cannot bind user',async()=>{
 const calls:ObjectValue[]=[];const db={rpc:(name:string,args:ObjectValue)=>{calls.push({name,...args});return Promise.resolve({data:true,error:null});}} as unknown as BrokerDb;
 await handleLineEvents([{type:'accountLink',webhookEventId:'offline-link',source:{type:'user',userId:line},link:{result:'ok',nonce:'high-entropy-nonce'}},{type:'accountLink',webhookEventId:'group-ignored',source:{type:'group',userId:line},link:{result:'ok',nonce:'spoof'}}],db,fetchFake(()=>{throw new Error('No provider request allowed');}));
 equal(calls.length,1);equal(calls[0].p_type,'accountLink');equal(calls[0].p_line_user,line);equal(typeof calls[0].p_nonce_hash,'string');equal(calls[0].p_success,true);
});
Deno.test('failed LINE linking invitation can be redelivered; dedup completed only after accepted reply',async()=>{
 Deno.env.set('LINE_LINK_ENABLED','true');Deno.env.set('LINE_CHANNEL_ACCESS_TOKEN','offline-token');Deno.env.set('BROKER_APP_URL','https://thaimora.example.org');
 const calls:string[]=[];let done=false,fetchCount=0;const db={rpc:(name:string)=>{calls.push(name);return Promise.resolve({data:name==='contact_line_event_seen'?done:(name==='contact_apply_line_event'?(done=true):true),error:null});}} as unknown as BrokerDb;
 const event={type:'message',webhookEventId:'redeliver-safe',source:{type:'user',userId:line},message:{type:'text',text:'link'},replyToken:'offline-reply'};
 const fetcher=fetchFake(url=>{fetchCount++;if(fetchCount===1)return new Response('{}',{status:503});return String(url).endsWith('/linkToken')?new Response(JSON.stringify({linkToken:'offlineLinkToken'})):new Response('{}',{status:200});});
 try{
  let failed=false;try{await handleLineEvents([event],db,fetcher);}catch{failed=true;}equal(failed,true);equal(done,false);
  await handleLineEvents([event],db,fetcher);equal(done,true);equal(calls.at(-1),'contact_apply_line_event');
  const count=fetchCount;await handleLineEvents([event],db,fetcher);equal(fetchCount,count);
 }finally{Deno.env.delete('LINE_LINK_ENABLED');Deno.env.delete('LINE_CHANNEL_ACCESS_TOKEN');Deno.env.delete('BROKER_APP_URL');}
});
Deno.test('scheduled contact signature is target-bound and expires; content token cannot authorize it',async()=>{
 const secret='a'.repeat(64),target='https://hpjmttoxomdhxxsourih.supabase.co/functions/v1/deliver-contact',stamp=String(Math.floor(Date.now()/1000));
 const signed=await signature(['contact-delivery-v1',stamp,id,target].join('\n'),secret,true),headers=new Headers({'X-Contact-Timestamp':stamp,'X-Contact-Nonce':id,'X-Contact-Signature':signed});
 equal((await contactWorkerSignature(headers,secret,target))?.nonce,id);
 equal(await contactWorkerSignature(headers,secret,target,Date.now()+61000),null);
 equal(await contactWorkerSignature(headers,secret,'https://yhavmtvzdtvqpylruzfa.supabase.co/functions/v1/deliver-contact'),null);
 headers.set('X-Contact-Signature',await signature(['content-sync-v1',stamp,id,target].join('\n'),secret,true));equal(await contactWorkerSignature(headers,secret,target),null);
});
