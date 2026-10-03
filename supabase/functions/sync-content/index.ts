import {client,env,json} from '../_shared/runtime.ts';
import {runContentSync,secretMatches,signedContentAuthorization} from '../_shared/content-sync.ts';
Deno.serve(async req=>{
 if(req.method!=='POST')return json({error:'method_not_allowed'},405);
 const bearer=req.headers.get('Authorization')??'';
 const permanentAuthorized=bearer.startsWith('Bearer ')&&secretMatches(bearer.slice(7),env('CONTENT_SYNC_SECRET'));
 const signed=permanentAuthorized?null:await signedContentAuthorization(req.headers,env('CONTENT_SYNC_SECRET'),env('SUPABASE_URL').replace(/\/$/,'')+'/functions/v1/sync-content');
 if(!permanentAuthorized&&!signed)return json({error:'unauthorized'},401);
 if(Number(req.headers.get('Content-Length')??0)>128)return json({error:'body_too_large'},413);
 let stage:'configuration'|'nonce'|'body'|'sync'='configuration';
 try{
  const db=client();
  stage='nonce';
  if(signed){const consumed=await db.rpc('consume_content_sync_nonce',{p_nonce:signed.nonce,p_timestamp:signed.timestamp}).abortSignal(AbortSignal.timeout(8000));if(consumed.error)return json({error:'content_worker_unavailable',stage},503);if(consumed.data!==true)return json({error:'unauthorized'},401);}
  stage='body';
  const reader=req.body?.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});let body='',size=0;
  if(reader){try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>128){await reader.cancel();return json({error:'body_too_large'},413);}body+=decoder.decode(value,{stream:true});}body+=decoder.decode();}finally{reader.releaseLock();}}
  if(!['','{}'].includes(body.trim()))return json({error:'invalid_body'},422);
  stage='sync';
  return json(await runContentSync(db));
 }
 catch{return json({error:'content_worker_unavailable',stage},503);}
});
