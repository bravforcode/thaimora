import {ApiError} from '../_shared/domain.ts';
import {client,json} from '../_shared/runtime.ts';
import {billingWebhook} from '../_shared/broker-webhook.ts';
import type {BrokerDb} from '../_shared/broker-api.ts';
Deno.serve(async req=>{
 try{return await billingWebhook(req,client() as unknown as BrokerDb);}catch(error){
  const safe=error instanceof ApiError?error:new ApiError(503,'billing_dependency_unavailable');return json({error:{code:safe.code}},safe.status);
 }
});
