import {ApiError} from '../../supabase/functions/_shared/domain.ts';
import {canonicalSubscription,monthlyPrice,signedBody,type ObjectValue,type StripeCall} from '../../supabase/functions/_shared/broker-billing.ts';
import {processBillingEvent} from '../../supabase/functions/_shared/broker-webhook.ts';
import {brokerDraft,brokerUser,type BrokerDb} from '../../supabase/functions/_shared/broker-api.ts';
function equal(actual:unknown,expected:unknown){if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error('Mismatch: '+JSON.stringify(actual)+' expected '+JSON.stringify(expected));}
async function rejects(run:()=>unknown|Promise<unknown>,code:string){try{await run();}catch(error){if(error instanceof ApiError&&error.code===code)return;throw error;}throw new Error('Expected '+code);}
const price={id:'price_Monthly',active:true,livemode:false,type:'recurring',unit_amount:2500,currency:'usd',recurring:{interval:'month',interval_count:1}};
function subscription(overrides:ObjectValue={}):ObjectValue {return {id:'sub_Real',customer:'cus_Broker',livemode:false,created:100,status:'active',cancel_at_period_end:false,items:{has_more:false,data:[{quantity:1,current_period_end:Math.floor(Date.now()/1000)+86400,price}]},latest_invoice:{id:'in_Current',customer:'cus_Broker',livemode:false,status:'paid',amount_paid:2500,amount_remaining:0},...overrides};}
function stripeFake(run:(path:string)=>ObjectValue):StripeCall {return path=>Promise.resolve().then(()=>run(path));}
function rpcFake(run:(name:string,args:ObjectValue)=>unknown):(name:string,args:ObjectValue)=>Promise<unknown> {return(name,args)=>Promise.resolve().then(()=>run(name,args));}
function stripeFor(rows:ObjectValue[],extra:ObjectValue={}):StripeCall {return stripeFake(path=>{if(!path.startsWith('/subscriptions?'))throw new Error('Unexpected provider path');return {has_more:false,data:rows,...extra};});}
function event(overrides:ObjectValue={}):ObjectValue {return {id:'evt_Safe',type:'customer.subscription.updated',livemode:false,data:{object:{customer:'cus_Broker',status:'active'}},...overrides};}
Deno.test('quoted monthly fee must match exact 25 USD single month canonical Price',()=>{
 equal(monthlyPrice(price,'price_Monthly',false),{amountMinor:2500,currency:'USD',interval:'month'});
 for(const change of [{unit_amount:3500},{currency:'thb'},{recurring:{interval:'year',interval_count:1}},{recurring:{interval:'month',interval_count:2}},{livemode:true}]){
  let denied=false;try{monthlyPrice({...price,...change},'price_Monthly',false);}catch{denied=true;}if(!denied)throw new Error('Wrong Price accepted');
 }
});
Deno.test('canonical paid active state qualifies only until exclusive period end',async()=>{
 const state=await canonicalSubscription(stripeFor([subscription()]),'cus_Broker','price_Monthly',false);equal(state.paid,true);equal(state.status,'active');
 const expired=subscription({items:{has_more:false,data:[{quantity:1,current_period_end:Math.floor(Date.now()/1000)-1,price}]}});
 equal((await canonicalSubscription(stripeFor([expired]),'cus_Broker','price_Monthly',false)).paid,false);
});
Deno.test('cancel-at-period-end preserves current paid state; immediate cancellation revokes',async()=>{
 const atEnd=await canonicalSubscription(stripeFor([subscription({cancel_at_period_end:true})]),'cus_Broker','price_Monthly',false);equal(atEnd.status,'active');equal(atEnd.cancelAtPeriodEnd,true);
 equal((await canonicalSubscription(stripeFor([subscription({status:'canceled'})]),'cus_Broker','price_Monthly',false)).status,'canceled');
});
Deno.test('failed or incomplete payment and paused collection do not grant active paid service',async()=>{
 const unpaid=subscription({status:'past_due',latest_invoice:{customer:'cus_Broker',livemode:false,status:'open',amount_paid:0,amount_remaining:2500}});
 equal((await canonicalSubscription(stripeFor([unpaid]),'cus_Broker','price_Monthly',false)).paid,false);
 equal((await canonicalSubscription(stripeFor([subscription({pause_collection:{behavior:'void'}})]),'cus_Broker','price_Monthly',false)).status,'paused');
});
Deno.test('invoice ownership, live mode, pagination, duplicate subscription, and quantity fail closed',async()=>{
 await rejects(()=>canonicalSubscription(stripeFor([subscription({latest_invoice:{customer:'cus_Other',livemode:false,status:'paid',amount_paid:2500,amount_remaining:0}})]),'cus_Broker','price_Monthly',false),'invoice_identity_mismatch');
 await rejects(()=>canonicalSubscription(stripeFor([subscription({livemode:true})]),'cus_Broker','price_Monthly',false),'subscription_identity_mismatch');
 await rejects(()=>canonicalSubscription(stripeFor([],{has_more:true}),'cus_Broker','price_Monthly',false),'subscription_catalog_incomplete');
 await rejects(()=>canonicalSubscription(stripeFor([subscription(),subscription({id:'sub_Second'})]),'cus_Broker','price_Monthly',false),'multiple_active_subscriptions');
 await rejects(()=>canonicalSubscription(stripeFor([subscription({items:{data:[{quantity:2,price}]}})]),'cus_Broker','price_Monthly',false),'subscription_price_mismatch');
});
Deno.test('raw UTF8 webhook signature verifies body and bounded timestamp, never parsed reserialization',async()=>{
 const raw='{"note":"ทดสอบ"}',secret='whsec_offline_fixture',stamp=String(Math.floor(Date.now()/1000));
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(stamp+'.'+raw))),sig=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join(''),header='t='+stamp+',v1='+sig;
 equal(await signedBody(raw,header,secret),true);equal(await signedBody(raw+' ',header,secret),false);
 equal(await signedBody(raw,header,secret,Date.now()+301000),false);equal(await signedBody(raw,header+',t='+stamp,secret),false);
});
Deno.test('webhook acquires customer lease before current-state fetch and commits event together',async()=>{
 const calls:string[]=[];let saved:unknown;
 const stripe=stripeFake(()=>{calls.push('canonical');return {has_more:false,data:[subscription()]};});
 const rpc=rpcFake((name,args)=>{calls.push(name);if(name==='broker_claim_payment_event')return {leaseToken:'00000000-0000-0000-0000-000000000001'};if(name==='broker_finish_payment_event'){saved=args.p_state;return true;}return null;});
 equal(await processBillingEvent(event(),{stripe,rpc,priceId:'price_Monthly',liveMode:false}),{received:true});
 equal(calls,['broker_claim_payment_event','canonical','broker_finish_payment_event']);equal((saved as ObjectValue).paid,true);
});
Deno.test('busy lease and completed duplicate do not refetch or mutate payment state',async()=>{
 const stripe=stripeFake(()=>{throw new Error('Provider called while busy/duplicate');});
 await rejects(()=>processBillingEvent(event(),{stripe,rpc:rpcFake(()=>({busy:true})),priceId:'price_Monthly',liveMode:false}),'billing_update_in_progress');
 equal(await processBillingEvent(event(),{stripe,rpc:rpcFake(()=>({duplicate:true})),priceId:'price_Monthly',liveMode:false}),{received:true,duplicate:true});
});
Deno.test('out-of-order active event cannot restore a canonically canceled subscription',async()=>{
 let saved:ObjectValue={};const rpc=rpcFake((name,args)=>{if(name==='broker_claim_payment_event')return {leaseToken:'lease'};if(name==='broker_finish_payment_event'){saved=args.p_state as ObjectValue;return true;}return null;});
 await processBillingEvent(event(),{stripe:stripeFor([subscription({status:'canceled'})]),rpc,priceId:'price_Monthly',liveMode:false});equal(saved.status,'canceled');
});
Deno.test('refund and dispute force sticky review block even canonical subscription is active',async()=>{
 for(const type of ['charge.refunded','charge.dispute.created']){
  let saved:ObjectValue={};const rpc=rpcFake((name,args)=>{if(name==='broker_claim_payment_event')return {leaseToken:'lease'};if(name==='broker_finish_payment_event'){saved=args.p_state as ObjectValue;return true;}return null;});
  const stripe=stripeFake(path=>path.startsWith('/charges/')?{customer:'cus_Broker'}:{has_more:false,data:[subscription()]});
  await processBillingEvent(event({type,data:{object:{customer:'cus_Broker',charge:'ch_Paid'}}}),{stripe,rpc,priceId:'price_Monthly',liveMode:false});
  equal(saved.blockedReason,type==='charge.refunded'?'refund_review_required':'dispute_review_required');
 }
});
Deno.test('lease expiration or provider failure returns retryable failure and preserves event for retry',async()=>{
 const calls:string[]=[];const rpc=rpcFake(name=>{calls.push(name);return name==='broker_claim_payment_event'?{leaseToken:'lease'}:false;});
 await rejects(()=>processBillingEvent(event(),{stripe:stripeFor([subscription()]),rpc,priceId:'price_Monthly',liveMode:false}),'billing_lease_expired');equal(calls.at(-1),'broker_fail_payment_event');
});
Deno.test('wrong webhook live mode and unrelated known signed types cannot grant roles',async()=>{
 const deps={stripe:stripeFor([]),rpc:rpcFake(()=>{throw new Error('Unexpected database grant');}),priceId:'price_Monthly',liveMode:false};
 await rejects(()=>processBillingEvent(event({livemode:true}),deps),'billing_mode_mismatch');equal(await processBillingEvent(event({type:'product.created'}),deps),{received:true,ignored:true});
});
Deno.test('broker draft rejects owner, role, payment, publication and exact-coordinate grants',async()=>{
 for(const key of ['userId','role','published','rightsStatus','stripeCustomerId'])await rejects(()=>brokerDraft({[key]:'spoof'},false),'broker_listing_fields_restricted');
 await rejects(()=>brokerDraft({privateLocation:{lat:7.9,lng:98.3,exactPublicationConsent:true}},false),'exact_location_requires_staff_review');
 const draft=brokerDraft({title:{en:'Own draft',th:'ประกาศร่าง'},privateLocation:{lat:7.9,lng:98.3,exactPublicationConsent:false},images:[{url:'https://images.example.org/owned.jpg',alt:{en:'Owned photo',th:'รูปที่ได้รับอนุญาต'},rightsEvidence:'owned-source-proof'}]},false);
 equal(draft.images?.[0].rights_status,'pending');equal(draft.privateLocation,{lat:7.9,lng:98.3});
});
Deno.test('authenticated broker identity requires validated bearer and verified email',async()=>{
 const db={auth:{getUser:()=>Promise.resolve({data:{user:{id:'00000000-0000-0000-0000-000000000001',email:'fixture@example.invalid'}},error:null})}} as unknown as BrokerDb;
 await rejects(()=>brokerUser(new Request('https://api.example.org'),db),'unauthorized');
 await rejects(()=>brokerUser(new Request('https://api.example.org',{headers:{Authorization:'Bearer fixture'}}),db),'verified_email_required');
});
