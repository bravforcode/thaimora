import {ApiError} from '../_shared/domain.ts';
import {client,env,json} from '../_shared/runtime.ts';
import {constantEqual} from '../_shared/broker-billing.ts';
import {brokerRpc,type BrokerDb} from '../_shared/broker-api.ts';
import {runContactDelivery,contactWorkerSignature} from '../_shared/contact-relay.ts';
Deno.serve(async req=>{
 try{
  if(req.method!=='POST')throw new ApiError(405,'method_not_allowed');
  const secret=env('CONTACT_WORKER_SECRET'),permanent=/^[a-f0-9]{64}$/.test(secret)&&constantEqual(req.headers.get('Authorization')??'','Bearer '+secret);
  const signed=permanent?null:await contactWorkerSignature(req.headers,secret,env('SUPABASE_URL').replace(/\/$/,'')+'/functions/v1/deliver-contact');
  if(!permanent&&!signed)throw new ApiError(401,'unauthorized');
  if(env('CONTACT_DELIVERY_ENABLED')!=='true')throw new ApiError(503,'contact_delivery_disabled');
  const db=client() as unknown as BrokerDb;
  if(signed&&await brokerRpc(db,'consume_contact_nonce',{p_nonce:signed.nonce,p_timestamp:signed.timestamp})!==true)throw new ApiError(401,'unauthorized');
  return json(await runContactDelivery({rpc:(name,args)=>brokerRpc(db,name,args),fetcher:fetch,emailKey:env('RESEND_API_KEY'),emailFrom:env('INQUIRY_EMAIL_FROM'),lineToken:env('LINE_CHANNEL_ACCESS_TOKEN')}));
 }catch(error){const safe=error instanceof ApiError?error:new ApiError(503,'contact_dependency_unavailable');return json({error:{code:safe.code}},safe.status);}
});
