import {ApiError,sha256,text} from './domain.ts';
import {body,env,json} from './runtime.ts';
import {brokerRpc,brokerUser,type BrokerDb} from './broker-api.ts';
import {constantEqual,record,type ObjectValue} from './broker-billing.ts';

export async function lineSignature(raw:string,signature:string|null,secret:string):Promise<boolean> {
 if(!secret||!signature||raw.length>262144)return false;
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(raw)));
 return constantEqual(signature,btoa(String.fromCharCode(...bytes)));
}
export async function contactWorkerSignature(headers:Headers,secret:string,target:string,now=Date.now()):Promise<{nonce:string;timestamp:number}|null> {
 const timestamp=headers.get('X-Contact-Timestamp')??'',nonce=headers.get('X-Contact-Nonce')??'',signature=headers.get('X-Contact-Signature')??'';
 if(!/^[a-f0-9]{64}$/.test(secret)||!/^https:\/\/[a-z0-9]{20}\.supabase\.co\/functions\/v1\/deliver-contact$/.test(target)
 ||!/^\d{10}$/.test(timestamp)||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(nonce)||!/^[a-f0-9]{64}$/.test(signature))return null;
 const seconds=Math.floor(now/1000),stamp=Number(timestamp);if(stamp<seconds-60||stamp>seconds+10)return null;
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signed=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(['contact-delivery-v1',timestamp,nonce,target].join('\n'))));
 const expected=Array.from(signed,b=>b.toString(16).padStart(2,'0')).join('');return constantEqual(expected,signature)?{nonce,timestamp:stamp}:null;
}
export async function contactRoute(req:Request,parts:string[],db:BrokerDb):Promise<Response|null> {
 if(parts[0]!=='contact')return null;
 const user=await brokerUser(req,db,false),action=parts[1];
 if(action==='preferences'){
  if(req.method==='GET')return json(await brokerRpc(db,'contact_preferences',{p_actor:user.id}));
  if(req.method==='PATCH'){
   const raw=record(await body(req));if(typeof raw.emailEnabled!=='boolean'||typeof raw.lineEnabled!=='boolean')throw new ApiError(422,'explicit_contact_choice_required');
   if((raw.emailEnabled||raw.lineEnabled)&&raw.consentAccepted!==true)throw new ApiError(422,'recipient_contact_consent_required');
   return json(await brokerRpc(db,'contact_save_preferences',{p_actor:user.id,p_email:user.email,p_email_enabled:raw.emailEnabled,p_line_enabled:raw.lineEnabled,p_version:typeof raw.consentVersion==='string'?raw.consentVersion:null}));
  }
 }
 if(action==='line-link'){
  if(req.method==='DELETE')return json(await brokerRpc(db,'contact_unlink_line',{p_actor:user.id}));
  if(req.method==='POST'){
   if(env('LINE_LINK_ENABLED')!=='true'||!env('LINE_CHANNEL_SECRET')||!env('LINE_CHANNEL_ACCESS_TOKEN'))throw new ApiError(503,'line_link_not_configured');
   const raw=record(await body(req)),token=text(raw.linkToken,1,1000);
   if(!/^[A-Za-z0-9_.-]+$/.test(token))throw new ApiError(422,'invalid_line_link_token');
   await brokerRpc(db,'contact_ensure_account',{p_actor:user.id,p_email:user.email});
   const nonce=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
   if(await brokerRpc(db,'contact_prepare_line_link',{p_actor:user.id,p_token_hash:await sha256(token),p_nonce_hash:await sha256(nonce)})!==true)throw new ApiError(422,'line_link_expired');
   return json({url:'https://access.line.me/dialog/bot/accountLink?'+new URLSearchParams({linkToken:token,nonce})});
  }
 }
 throw new ApiError(404,'contact_route_not_found');
}
export type RelayDeps={rpc:(name:string,args:Record<string,unknown>)=>Promise<unknown>;fetcher:typeof fetch;emailKey:string;emailFrom:string;lineToken:string};
export function contactMessage(payload:ObjectValue):string {
 return 'Property inquiry '+text(payload.propertyId,36,36)+'\nName: '+text(payload.name,2,100)+'\nEmail: '+text(payload.email,3,254)+'\nCountry: '+text(payload.country,2,80)+'\n\n'+text(payload.message,10,4000);
}
export async function runContactDelivery(deps:RelayDeps):Promise<{sent:number;failed:number;canceled:number}> {
 const channels=[...(deps.emailKey&&deps.emailFrom?['email']:[]),...(deps.lineToken?['line']:[])];
 if(channels.length===0)throw new ApiError(503,'contact_provider_not_configured');
 const claimed=await deps.rpc('contact_claim_batch',{p_limit:5,p_channels:channels});if(!Array.isArray(claimed)||claimed.length>5)throw new ApiError(503,'contact_database_unavailable');
 let sent=0,failed=0,canceled=0;
 await Promise.all(claimed.map(async value=>{
  const task=record(value),id=text(task.id,36,36),token=text(task.lease_token,36,36);
  try{
   const value=await deps.rpc('contact_delivery_payload',{p_id:id,p_token:token});if(!value){canceled++;return;}
   const payload=record(value),message=contactMessage(payload);let accepted=false;
   if(payload.channel==='email'){
    if(!deps.emailKey||!deps.emailFrom)throw new ApiError(503,'contact_provider_not_configured');
    const recipient=text(payload.recipient,3,254);if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient))throw new ApiError(422,'invalid_contact_recipient');
    const response=await deps.fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+deps.emailKey,'Content-Type':'application/json','Idempotency-Key':'contact-'+id},
     body:JSON.stringify({from:deps.emailFrom,to:[recipient],reply_to:payload.email,subject:'Property inquiry '+payload.propertyId,text:message}),signal:AbortSignal.timeout(8000)});
    accepted=response.ok;await response.body?.cancel();
   }else if(payload.channel==='line'){
    if(!deps.lineToken||typeof payload.recipient!=='string'||!/^U[0-9a-f]{32}$/.test(payload.recipient))throw new ApiError(422,'invalid_contact_recipient');
    const response=await deps.fetcher('https://api.line.me/v2/bot/message/push',{method:'POST',headers:{Authorization:'Bearer '+deps.lineToken,'Content-Type':'application/json','X-Line-Retry-Key':id},
     body:JSON.stringify({to:payload.recipient,messages:[{type:'text',text:message}]}),signal:AbortSignal.timeout(8000)});
    accepted=response.ok||(response.status===409&&Boolean(response.headers.get('x-line-accepted-request-id')));await response.body?.cancel();
   }else throw new ApiError(422,'invalid_contact_channel');
   if(!accepted)throw new ApiError(503,'contact_provider_unavailable');
   if(await deps.rpc('contact_finish_delivery',{p_id:id,p_token:token,p_sent:true})!==true)throw new ApiError(503,'contact_delivery_state_not_saved');sent++;
  }catch{await deps.rpc('contact_finish_delivery',{p_id:id,p_token:token,p_sent:false});failed++;}
 }));
 return {sent,failed,canceled};
}
export async function handleLineEvents(events:unknown[],db:BrokerDb,fetcher:typeof fetch=fetch):Promise<void> {
 if(events.length>50)throw new ApiError(413,'line_event_limit');
 for(const raw of events){
  const event=record(raw),source=record(event.source),userId=source.userId;
  if(source.type!=='user'||typeof userId!=='string'||!/^U[0-9a-f]{32}$/.test(userId))continue;
  const eventId=text(event.webhookEventId,1,200),type=String(event.type);
  if(type==='accountLink'||type==='unfollow'){
   const link=type==='accountLink'?record(event.link):{};
   await brokerRpc(db,'contact_apply_line_event',{p_event:eventId,p_type:type,p_line_user:userId,p_nonce_hash:typeof link.nonce==='string'?await sha256(link.nonce):null,p_success:link.result==='ok'});
  }else if(type==='message'&&env('LINE_LINK_ENABLED')==='true'){
   const message=record(event.message);
   if(message.type!=='text'||message.text!=='link')continue;
   // A token is requested only for a user who messages this configured OA.
   if(await brokerRpc(db,'contact_line_event_seen',{p_event:eventId})===true)continue;
   const auth={Authorization:'Bearer '+env('LINE_CHANNEL_ACCESS_TOKEN')},response=await fetcher('https://api.line.me/v2/bot/user/'+userId+'/linkToken',{method:'POST',headers:auth,signal:AbortSignal.timeout(8000)});
   if(!response.ok)throw new ApiError(503,'line_provider_unavailable');
   const token=text(record(await response.json()).linkToken,1,1000);
   await brokerRpc(db,'contact_record_line_token',{p_hash:await sha256(token),p_line_user:userId});
   const app=new URL(env('BROKER_APP_URL'));if(app.protocol!=='https:'||app.username||app.password)throw new ApiError(503,'broker_origin_not_configured');
   const linkUrl=app.origin+'/broker/?'+new URLSearchParams({lineLinkToken:token});
   const reply=await fetcher('https://api.line.me/v2/bot/message/reply',{method:'POST',headers:{...auth,'Content-Type':'application/json'},
    body:JSON.stringify({replyToken:text(event.replyToken,1,200),messages:[{type:'text',text:'Sign in to link your Thaimora account: '+linkUrl}]}),signal:AbortSignal.timeout(8000)});
   if(!reply.ok)throw new ApiError(503,'line_provider_unavailable');await reply.body?.cancel();
   await brokerRpc(db,'contact_apply_line_event',{p_event:eventId,p_type:'message',p_line_user:userId});
  }
 }
}
