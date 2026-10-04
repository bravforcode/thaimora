import {ApiError} from '../_shared/domain.ts';
import {client,env,json} from '../_shared/runtime.ts';
import {handleLineEvents,lineSignature} from '../_shared/contact-relay.ts';
import {record} from '../_shared/broker-billing.ts';
import type {BrokerDb} from '../_shared/broker-api.ts';
Deno.serve(async req=>{
 try{
  if(req.method!=='POST')throw new ApiError(405,'method_not_allowed');
  if(!env('LINE_CHANNEL_SECRET'))throw new ApiError(503,'line_not_configured');
  const raw=await req.text();if(raw.length>262144)throw new ApiError(413,'body_too_large');
  if(!await lineSignature(raw,req.headers.get('X-Line-Signature'),env('LINE_CHANNEL_SECRET')))throw new ApiError(400,'invalid_line_signature');
  const value=record(JSON.parse(raw));if(!Array.isArray(value.events))throw new ApiError(400,'invalid_line_events');
  await handleLineEvents(value.events,client() as unknown as BrokerDb);return json({received:true});
 }catch(error){const safe=error instanceof ApiError?error:new ApiError(503,'line_dependency_unavailable');return json({error:{code:safe.code}},safe.status);}
});
