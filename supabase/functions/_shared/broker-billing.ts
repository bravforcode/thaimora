import {ApiError} from './domain.ts';

export const STRIPE_VERSION='2026-08-26.dahlia';
export type ObjectValue=Record<string,unknown>;
export function record(value:unknown):ObjectValue {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new ApiError(503,'invalid_provider_response');
 return value as ObjectValue;
}
export function objectId(value:unknown,prefix:string):string {
 const id=typeof value==='string'?value:record(value).id;
 if(typeof id!=='string'||!new RegExp('^'+prefix+'_[A-Za-z0-9]+$').test(id))throw new ApiError(422,'invalid_provider_id');
 return id;
}
export async function signedBody(raw:string,header:string|null,secret:string,now=Date.now()):Promise<boolean> {
 if(!secret||!header||raw.length>262144)return false;
 const parts=header.split(',').map(s=>s.split('=')),timestamps=parts.filter(([k])=>k==='t');
 if(timestamps.length!==1||!/^\d{10}$/.test(timestamps[0][1]??''))return false;
 const timestamp=Number(timestamps[0][1]);if(Math.abs(now/1000-timestamp)>300)return false;
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(timestamp+'.'+raw)));
 const expected=Array.from(signature,b=>b.toString(16).padStart(2,'0')).join('');
 return parts.some(([name,value])=>name==='v1'&&constantEqual(value??'',expected));
}
export function constantEqual(a:string,b:string):boolean {
 let difference=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)difference|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);
 return difference===0;
}
export type StripeCall=(path:string,method?:'GET'|'POST',form?:URLSearchParams,idempotency?:string)=>Promise<ObjectValue>;
export function stripeClient(secret:string,fetcher:typeof fetch=fetch):StripeCall {
 if(!/^sk_(test|live)_[A-Za-z0-9]+$/.test(secret))throw new ApiError(503,'billing_not_configured');
 return async(path,method='GET',form,idempotency)=>{
  if(!/^\/(customers|prices|subscriptions|invoices|charges|checkout\/sessions|billing_portal\/sessions)(\/|\?|$)/.test(path))throw new ApiError(503,'invalid_billing_operation');
  const headers:Record<string,string>={Authorization:'Bearer '+secret,'Stripe-Version':STRIPE_VERSION};
  if(form)headers['Content-Type']='application/x-www-form-urlencoded';if(idempotency)headers['Idempotency-Key']=idempotency;
  let response:Response;try{response=await fetcher('https://api.stripe.com/v1'+path,{method,headers,body:form,signal:AbortSignal.timeout(8000)});}catch{throw new ApiError(503,'billing_provider_unavailable');}
  if(!response.ok)throw new ApiError(503,'billing_provider_unavailable');
  const raw=await response.text();if(raw.length>1048576)throw new ApiError(503,'invalid_provider_response');
  try{return record(JSON.parse(raw));}catch{throw new ApiError(503,'invalid_provider_response');}
 };
}
export function monthlyPrice(value:unknown,priceId:string,live:boolean):{amountMinor:number;currency:string;interval:'month'} {
 const p=record(value),r=record(p.recurring);
 if(p.id!==priceId||p.livemode!==live||p.active!==true||p.type!=='recurring'||r.interval!=='month'||r.interval_count!==1
 ||p.unit_amount!==2500||p.currency!=='usd')throw new ApiError(503,'monthly_price_not_configured');
 return {amountMinor:Number(p.unit_amount),currency:p.currency.toUpperCase(),interval:'month'};
}
export type BillingState={priceId:string;liveMode:boolean;subscriptionId:string|null;status:string;paid:boolean;currentPeriodEnd:string|null;cancelAtPeriodEnd:boolean;blockedReason?:string};
export async function canonicalSubscription(stripe:StripeCall,customer:string,priceId:string,live:boolean,blockedReason?:string):Promise<BillingState> {
 const page=await stripe('/subscriptions?'+new URLSearchParams({customer,status:'all',limit:'100','expand[]':'data.latest_invoice'}));
 if(page.has_more!==false||!Array.isArray(page.data))throw new ApiError(503,'subscription_catalog_incomplete');
 const candidates:ObjectValue[]=[];
 for(const entry of page.data){
  const s=record(entry);if(objectId(s.customer,'cus')!==customer||s.livemode!==live)throw new ApiError(503,'subscription_identity_mismatch');
  const items=record(s.items);if(items.has_more===true||!Array.isArray(items.data))throw new ApiError(503,'subscription_items_incomplete');
  const matching=items.data.filter(item=>{const row=record(item);return record(row.price).id===priceId;});
  if(matching.length===0)continue;
  if(items.data.length!==1||matching.length!==1||record(matching[0]).quantity!==1)throw new ApiError(503,'subscription_price_mismatch');
  monthlyPrice(record(matching[0]).price,priceId,live);candidates.push(s);
 }
 const active=candidates.filter(s=>s.status==='active');
 if(active.length>1)throw new ApiError(503,'multiple_active_subscriptions');
 const s=active[0]??candidates.sort((a,b)=>Number(b.created)-Number(a.created))[0];
 const result:BillingState={priceId,liveMode:live,subscriptionId:null,status:'none',paid:false,currentPeriodEnd:null,cancelAtPeriodEnd:false};
 if(blockedReason)result.blockedReason=blockedReason;if(!s)return result;
 result.subscriptionId=objectId(s.id,'sub');
 result.status=['active','past_due','canceled','unpaid','paused','incomplete'].includes(String(s.status))?String(s.status):'incomplete';
 if(s.pause_collection)result.status='paused';
 result.cancelAtPeriodEnd=s.cancel_at_period_end===true;
 const items=record(s.items).data as unknown[],item=record(items[0]);
 const end=Number(item.current_period_end??s.current_period_end);
 if(Number.isSafeInteger(end)&&end>0)result.currentPeriodEnd=new Date(end*1000).toISOString();
 if(s.latest_invoice){
  const invoice=typeof s.latest_invoice==='string'?await stripe('/invoices/'+objectId(s.latest_invoice,'in')):record(s.latest_invoice);
  if(objectId(invoice.customer,'cus')!==customer||invoice.livemode!==live)throw new ApiError(503,'invoice_identity_mismatch');
  result.paid=invoice.status==='paid'&&Number(invoice.amount_paid)>0&&invoice.amount_remaining===0;
 }
 if(!result.currentPeriodEnd||Date.parse(result.currentPeriodEnd)<=Date.now())result.paid=false;
 return result;
}
export const relevantBillingEvents=new Set(['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed',
 'customer.subscription.created','customer.subscription.updated','customer.subscription.deleted','customer.subscription.paused','customer.subscription.resumed',
 'invoice.paid','invoice.payment_failed','invoice.payment_action_required','charge.refunded','charge.dispute.created','charge.dispute.closed']);
