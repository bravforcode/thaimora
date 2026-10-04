import {ApiError} from './domain.ts';
import {env,json} from './runtime.ts';
import {brokerRpc,type BrokerDb} from './broker-api.ts';
import {canonicalSubscription,objectId,record,relevantBillingEvents,signedBody,stripeClient,type ObjectValue,type StripeCall} from './broker-billing.ts';

export type BillingWebhookDeps={stripe:StripeCall;rpc:(name:string,args:Record<string,unknown>)=>Promise<unknown>;priceId:string;liveMode:boolean};
export async function processBillingEvent(event:ObjectValue,deps:BillingWebhookDeps):Promise<{received:true;duplicate?:boolean;ignored?:boolean}> {
 const id=objectId(event.id,'evt'),type=String(event.type);
 if(event.livemode!==deps.liveMode)throw new ApiError(400,'billing_mode_mismatch');
 if(!relevantBillingEvents.has(type))return {received:true,ignored:true};
 const data=record(record(event.data).object);
 let customer=data.customer;
 if(type.startsWith('charge.dispute.')){const charge=await deps.stripe('/charges/'+objectId(data.charge,'ch'));customer=charge.customer;}
 if(!customer)return {received:true,ignored:true};
 const customerId=objectId(customer,'cus');
 const claim=record(await deps.rpc('broker_claim_payment_event',{p_event:id,p_type:type,p_customer:customerId}));
 if(claim.unknownCustomer)return {received:true,ignored:true};if(claim.duplicate)return {received:true,duplicate:true};
 if(claim.busy)throw new ApiError(503,'billing_update_in_progress');
 const token=String(claim.leaseToken);
 try{
  // Serialize before the current-state fetch. Event timestamps alone do not order concurrent callbacks.
  const blocked=type==='charge.refunded'?'refund_review_required':type.startsWith('charge.dispute.')?'dispute_review_required':undefined;
  const state=await canonicalSubscription(deps.stripe,customerId,deps.priceId,deps.liveMode,blocked);
  if(await deps.rpc('broker_finish_payment_event',{p_event:id,p_token:token,p_state:state})!==true)throw new ApiError(503,'billing_lease_expired');
  return {received:true};
 }catch(error){await deps.rpc('broker_fail_payment_event',{p_event:id,p_token:token}).catch(()=>undefined);throw error;}
}
export async function billingWebhook(req:Request,db:BrokerDb):Promise<Response> {
 if(req.method!=='POST')throw new ApiError(405,'method_not_allowed');
 if(env('BROKER_BILLING_ENABLED')!=='true'||!env('STRIPE_WEBHOOK_SECRET'))throw new ApiError(503,'billing_not_configured');
 const raw=await req.text();if(raw.length>262144)throw new ApiError(413,'body_too_large');
 if(!await signedBody(raw,req.headers.get('Stripe-Signature'),env('STRIPE_WEBHOOK_SECRET')))throw new ApiError(400,'invalid_billing_signature');
 let event:ObjectValue;try{event=record(JSON.parse(raw));}catch{throw new ApiError(400,'invalid_billing_event');}
 const config=record(await brokerRpc(db,'broker_internal_config'));
 if(config.billing_enabled!==true||!config.stripe_price_id)throw new ApiError(503,'billing_not_configured');
 const key=env('STRIPE_SECRET_KEY'),live=config.stripe_live_mode===true;
 if((live&&!key.startsWith('sk_live_'))||(!live&&!key.startsWith('sk_test_')))throw new ApiError(503,'billing_mode_not_configured');
 return json(await processBillingEvent(event,{stripe:stripeClient(key),rpc:(name,args)=>brokerRpc(db,name,args),priceId:String(config.stripe_price_id),liveMode:live}));
}
