// Bounded actual HTTP/Auth verification. Synthetic draft fixtures never become public.
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const validId=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
async function main(){
 const site=process.argv[2]??'';if(!['thaimora','taotide'].includes(site))throw new Error('Selected site required');
 const need=(key:string)=>{const value=process.env[key];if(!value)throw new Error('Missing configuration');return value;};
 const backend=new URL(need('SUPABASE_URL')),api=new URL(need('NEXT_PUBLIC_API_URL')),origin=new URL(need('NEXT_PUBLIC_SITE_URL')).origin;
 const publicKey=need('NEXT_PUBLIC_SUPABASE_ANON_KEY'),serviceKey=need('SUPABASE_SERVICE_ROLE_KEY');
 if(!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(backend.origin)||backend.username||backend.password||api.origin!==backend.origin||api.pathname!=='/functions/v1/api'||api.search||api.hash||api.username||api.password||!publicKey.startsWith('sb_publishable_')||publicKey===serviceKey)throw new Error('Selected backend mismatch');
 const claims=JSON.parse(Buffer.from(serviceKey.split('.')[1]??'','base64url').toString('utf8'));
 if(claims.role!=='service_role'||claims.ref!==backend.hostname.split('.')[0])throw new Error('Private project key mismatch');
 type Result={status:number;ok:boolean;body:any;cors:string|null};
 async function request(url:string,init:RequestInit={}):Promise<Result>{
  const response=await fetch(url,{...init,signal:AbortSignal.timeout(15000),redirect:'error'});
  const raw=await response.text();let body:any=null;try{if(raw.trim())body=JSON.parse(raw);}catch{/* malformed responses are not success proof */}
  return {status:response.status,ok:response.ok,body,cors:response.headers.get('Access-Control-Allow-Origin')};
 }
 async function privileged(path:string,init:RequestInit={}):Promise<Result>{return request(backend.origin+path,{...init,headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey,'X-Supabase-Api-Version':'2024-01-01','Content-Type':'application/json',...init.headers}});}
 const cases:{name:string;status:number;passed:boolean}[]=[];
 let phase='initialization',failurePhase:string|null=null,fixtureId:string|undefined,creationAttempted=false,eventAttempted=false,cleanupFailed=false;
 const fixtureEmail='smoke-content-'+randomUUID()+'@example.invalid',eventId=('content-smoke:'+randomUUID()).padEnd(115,'x'),password=randomUUID()+randomUUID();
 const cleanup={event:false,membership:false,auth:false,reconciledCreate:false};
 function proof(name:string,response:Result,validate:(body:any)=>boolean,status=200){const passed=response.status===status&&validate(response.body);cases.push({name,status:response.status,passed});if(!passed)throw new Error('Synthetic proof failed');}
 async function probe(name:string,path:string,token:string,init:RequestInit={},validate:(body:any)=>boolean=()=>true,status=200){
  phase=name;const result=await request(api.href+path,{...init,headers:{Origin:origin,Authorization:'Bearer '+token,'Content-Type':'application/json',...init.headers}});
  proof(name,result,body=>result.cors===origin&&validate(body),status);return result.body;
 }
 async function reconcileCreation(){
  // An uncertain create can be cleaned only by this exact unique synthetic email.
  // A complete empty list alone never proves that a timed-out write did not persist later.
  for(let page=1;page<=10;page++){
   const result=await privileged('/auth/v1/admin/users?page='+page+'&per_page=100');
   if(!result.ok||!Array.isArray(result.body?.users))throw new Error('Auth reconciliation unavailable');
   const matches=result.body.users.filter((u:any)=>u.email===fixtureEmail);
   if(matches.length>1)throw new Error('Ambiguous fixture identity');
   if(matches.length===1){if(!validId(matches[0].id))throw new Error('Invalid fixture identity');fixtureId=matches[0].id;cleanup.reconciledCreate=true;return;}
   if(result.body.users.length<100)return;
  }
  throw new Error('Auth reconciliation bound exceeded');
 }
 try{
  phase='fixture-create';creationAttempted=true;
  const created=await privileged('/auth/v1/admin/users',{method:'POST',body:JSON.stringify({email:fixtureEmail,password,email_confirm:true})});
  const user=created.body?.user??created.body;
  if(user?.email===fixtureEmail&&validId(user.id))fixtureId=user.id;
  if(!created.ok||!fixtureId)throw new Error('Synthetic Auth creation failed');
  phase='fixture-sign-in';
  const signed=await request(backend.origin+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:publicKey,'Content-Type':'application/json','X-Supabase-Api-Version':'2024-01-01'},body:JSON.stringify({email:fixtureEmail,password})});
  if(!signed.ok||typeof signed.body?.access_token!=='string'||!signed.body.access_token)throw new Error('Synthetic sign-in failed');
  const token=signed.body.access_token;
  phase='fixture-membership';
  const membership=await privileged('/rest/v1/admin_memberships',{method:'POST',body:JSON.stringify({user_id:fixtureId,role:'admin'})});
  if(!membership.ok)throw new Error('Synthetic membership failed');
  const draft={id:eventId,name:{en:'Synthetic unpublished smoke fixture',th:'Synthetic unpublished smoke fixture'},description:{en:'Automated verification only',th:'Automated verification only'},starts_at:new Date(Date.now()+86400000).toISOString(),ends_at:new Date(Date.now()+172800000).toISOString(),location:{lat:site==='thaimora'?7.9:10.1,lng:site==='thaimora'?98.35:99.83},source:'synthetic-smoke',source_url:'https://example.invalid/fixture',license:'Synthetic fixture; no publication rights',rights_status:'pending',published:false,demo:true,admin_override:false};
  eventAttempted=true;
  await probe('create-forces-manual-override','/v1/admin/events',token,{method:'POST',body:JSON.stringify(draft)},body=>body?.item?.id===eventId&&body.item.admin_override===true&&body.item.published===false&&body.item.demo===true&&body.item.rights_status==='pending',site==='taotide'?201:200);
  await probe('patch-forces-manual-override','/v1/admin/events/'+encodeURIComponent(eventId),token,{method:'PATCH',body:JSON.stringify({description:{en:'Patched synthetic fixture',th:'Patched synthetic fixture'},admin_override:false})},body=>body?.item?.admin_override===true&&body.item.published===false&&body.item.demo===true&&body.item.rights_status==='pending');
  await probe('implicit-release-refused','/v1/admin/events/'+encodeURIComponent(eventId)+'/automation',token,{method:'POST',body:JSON.stringify({enabled:false})},body=>!!body?.error,422);
  await probe('explicit-automation-release','/v1/admin/events/'+encodeURIComponent(eventId)+'/automation',token,{method:'POST',body:JSON.stringify({enabled:true})},body=>body?.item?.id===eventId&&body.item.adminOverride===false&&body.item.automaticSyncEnabled===true);
  await probe('release-keeps-unpublished-pending-demo','/v1/admin/events/'+encodeURIComponent(eventId),token,{},body=>Array.isArray(body?.items)&&body.items.length===1&&body.items[0].admin_override===false&&body.items[0].rights_status==='pending'&&body.items[0].published===false&&body.items[0].demo===true);
  phase='release-audit-verified';
  const audit=await privileged('/rest/v1/admin_audit_log?select=actor_id,metadata&actor_id=eq.'+fixtureId+'&record_id=eq.'+encodeURIComponent(eventId)+'&operation=eq.ADMIN_ACTION');
  proof(phase,audit,body=>Array.isArray(body)&&body.some(row=>row.actor_id===fixtureId&&row.metadata?.automaticSyncEnabled===true&&row.metadata?.fields?.includes('admin_override')));
  await probe('public-content-excludes-draft-demo','/v1/content?scope=events',token,{},body=>Array.isArray(body?.events)&&!body.events.some((e:any)=>e.id===eventId));
 }catch{failurePhase=phase;}
 finally{
  // Attempt each exact fixture cleanup in the documented order, even after lost responses.
  if(eventAttempted){try{
   await privileged('/rest/v1/events?id=eq.'+encodeURIComponent(eventId),{method:'DELETE'});
   const check=await privileged('/rest/v1/events?select=id&id=eq.'+encodeURIComponent(eventId));
   cleanup.event=check.status===200&&Array.isArray(check.body)&&check.body.length===0;
  }catch{/* absence must be verified */}}else cleanup.event=true;
  if(!fixtureId&&creationAttempted){try{await reconcileCreation();}catch{/* preserve exact email for owner reconciliation */}}
  if(fixtureId){
   try{
    await privileged('/rest/v1/admin_memberships?user_id=eq.'+fixtureId,{method:'DELETE'});
    const check=await privileged('/rest/v1/admin_memberships?select=user_id&user_id=eq.'+fixtureId);
    cleanup.membership=check.status===200&&Array.isArray(check.body)&&check.body.length===0;
   }catch{/* absence must be verified */}
   try{
    await privileged('/auth/v1/admin/users/'+fixtureId,{method:'DELETE',body:JSON.stringify({should_soft_delete:false})});
    const check=await privileged('/auth/v1/admin/users/'+fixtureId);
    cleanup.auth=check.status===404&&(check.body?.code==='user_not_found'||check.body?.error_code==='user_not_found');
   }catch{/* a timeout/server error is not deletion proof */}
  }else if(!creationAttempted){cleanup.membership=true;cleanup.auth=true;}
  cleanupFailed=!cleanup.event||!cleanup.membership||!cleanup.auth;
  const report={site,projectRef:backend.hostname.split('.')[0],testedAt:new Date().toISOString(),passed:failurePhase===null&&!cleanupFailed,cases,caseCount:cases.length,passedCount:cases.filter(c=>c.passed).length,failurePhase,creationAttempted,eventAttempted,fixtureEmail,eventFixtureId:eventId,cleanupConfirmed:!cleanupFailed,cleanupFailed,cleanup,scope:'Actual HTTP/Auth/admin override release; synthetic unpublished demo only; no source/provider/email calls'};
  await mkdir(resolve('scripts/output/production'),{recursive:true});await writeFile(resolve('scripts/output/production/smoke-content-admin.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
  if(!report.passed)process.exitCode=1;
 }
}
void main().catch(()=>{console.error('Content admin smoke failed; inspect the safe report and reconcile its exact fixture identifiers. No credentials logged.');process.exitCode=1;});
