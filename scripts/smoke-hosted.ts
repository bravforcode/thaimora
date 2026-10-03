// Real HTTP checks against the explicitly selected backend. No provider/email calls.
// Auth fixtures use an ephemeral synthetic account and are deleted in finally.
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
async function main(){
const site=process.argv[2]??'';
if(!['thaimora','taotide'].includes(site))throw new Error('Pass thaimora or taotide');
function need(key:string){const value=process.env[key];if(!value)throw new Error('Missing '+key);return value;}
const backend=new URL(need('SUPABASE_URL')),api=new URL(need('NEXT_PUBLIC_API_URL')),origin=new URL(need('NEXT_PUBLIC_SITE_URL')).origin;
if(backend.protocol!=='https:'||!/^([a-z]{20})\.supabase\.co$/.test(backend.hostname)||api.origin!==backend.origin||api.pathname!=='/functions/v1/api')throw new Error('Selected Supabase API origin mismatch');
const publicKey=need('NEXT_PUBLIC_SUPABASE_ANON_KEY'),serviceKey=need('SUPABASE_SERVICE_ROLE_KEY');
if(!publicKey.startsWith('sb_publishable_')||publicKey===serviceKey)throw new Error('Public publishable key required');
const claims=JSON.parse(Buffer.from(serviceKey.split('.')[1]??'','base64url').toString('utf8'));
if(claims.role!=='service_role'||claims.ref!==backend.hostname.split('.')[0])throw new Error('Private service key project mismatch');
const cases:{name:string;status:number;passed:boolean}[]=[];
let phase='initialization',failurePhase:string|null=null,cleanupFailed=false;
async function probe(name:string,path:string,status:number,init:RequestInit={},validate?:(body:any)=>boolean){
 phase=name;
 const response=await fetch(api.href+path,{...init,headers:{Origin:origin,...init.headers},signal:AbortSignal.timeout(30000),redirect:'error'});
 const cors=response.headers.get('access-control-allow-origin');
 const body=await response.json().catch(()=>null);
 const wrongOrigin=init.headers&&new Headers(init.headers).get('Origin')!==null&&new Headers(init.headers).get('Origin')!==origin;
 const passed=response.status===status&&(!wrongOrigin?cors===origin:!cors)&&(!validate||validate(body));
 cases.push({name,status:response.status,passed});
 if(!passed)throw new Error('Hosted check failed: '+name+' (HTTP '+response.status+')');
 return body;
}
const kind=site==='thaimora'?'properties':'hotels';
async function backendRequest(path:string,key:string,token:string|undefined,init:RequestInit={}){
 const headers=new Headers(init.headers);
 headers.set('apikey',key);
 if(path.startsWith('/auth/v1/'))headers.set('X-Supabase-Api-Version','2024-01-01');
 if(token)headers.set('Authorization','Bearer '+token);
 if(init.body)headers.set('Content-Type','application/json');
 const response=await fetch(backend.origin+path,{...init,headers,signal:AbortSignal.timeout(30000),redirect:'error'});
 return {status:response.status,ok:response.ok,body:await response.json().catch(()=>null)};
}
const privilegedRequest=(path:string,init:RequestInit={})=>backendRequest(path,serviceKey,serviceKey,init);
let fixtureId:string|undefined,fixtureEmail:string|null=null,creationAttempted=false,cleanupConfirmed=false;
try{
 phase='anonymous-rest-public-surface';
 const publicSurface=await backendRequest('/rest/v1/zones?select=id&limit=1',publicKey,undefined);
 const publicSurfacePassed=publicSurface.status===200&&Array.isArray(publicSurface.body);
 cases.push({name:phase,status:publicSurface.status,passed:publicSurfacePassed});
 if(!publicSurfacePassed)throw new Error('Public REST key check failed');
 await probe('public-content','/v1/content',200,{},body=>Array.isArray(body?.pois)&&Array.isArray(body?.events));
 if(site==='thaimora')await probe('public-property-search','/v1/properties?limit=10',200,{},body=>Array.isArray(body?.items));
 else await probe('informational-zones','/v1/zones',200,{},body=>Array.isArray(body?.items)&&body.items.length===8);
 await probe('admin-missing-token','/v1/admin/'+kind,401);
 await probe('admin-invalid-token','/v1/admin/'+kind,401,{headers:{Authorization:'Bearer invalid-synthetic-token'}});
 await probe('foreign-origin-denied','/v1/content',403,{headers:{Origin:'https://foreign-origin.invalid'}});
 phase='cors-preflight';
 const options=await fetch(api.href+'/v1/content',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'GET'},signal:AbortSignal.timeout(30000),redirect:'error'});
 const optionsPassed=options.status===204&&options.headers.get('access-control-allow-origin')===origin;
 cases.push({name:'cors-preflight',status:options.status,passed:optionsPassed});if(!optionsPassed)throw new Error('CORS preflight failed');
 const privateTables=site==='thaimora'?['inquiries','property_private_locations','email_outbox','admin_memberships']:['affiliate_clicks','provider_settings','admin_memberships','source_quarantine'];
 for(const table of privateTables){
  phase='public-denied-'+table;
  const response=await backendRequest('/rest/v1/'+table+'?select=*',publicKey,undefined);
  // PostgREST maps insufficient_privilege to 401 for anonymous requests;
  // 403 is also a denial, but neither status proves table privacy alone.
  const passed=[401,403].includes(response.status)&&response.body?.code==='42501';cases.push({name:'public-denied-'+table,status:response.status,passed});
  if(!passed)throw new Error('Public table privilege check failed: '+table+' (HTTP '+response.status+')');
 }
 // createUser does not send email; this confirms only a deliberately synthetic test identity.
 const password=randomUUID()+randomUUID();
 phase='fixture-create';
 fixtureEmail='smoke-'+randomUUID()+'@tests.invalid';
 creationAttempted=true;
 const created=await privilegedRequest('/auth/v1/admin/users',{method:'POST',body:JSON.stringify({email:fixtureEmail,password,email_confirm:true})});
 const createdUser=created.body?.user??created.body;
 // Bind cleanup to this exact synthetic identity, including error responses
 // that contain its valid ID. Never delete an unrelated returned identity.
 if(createdUser?.email===fixtureEmail&&typeof createdUser.id==='string'&&/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(createdUser.id))fixtureId=createdUser.id;
 if(!created.ok||!fixtureId)throw new Error('Synthetic Auth fixture creation failed');
 phase='fixture-sign-in';
 const signedIn=await backendRequest('/auth/v1/token?grant_type=password',publicKey,undefined,{method:'POST',body:JSON.stringify({email:fixtureEmail,password})});
 if(!signedIn.ok||typeof signedIn.body?.access_token!=='string'||!signedIn.body.access_token)throw new Error('Actual Auth sign-in failed');
 const accessToken=signedIn.body.access_token as string;
 const authorization='Bearer '+accessToken;
 await probe('authenticated-nonstaff-denied','/v1/admin/'+kind,403,{headers:{Authorization:authorization}});
 phase='fixture-membership';
 const membership=await privilegedRequest('/rest/v1/admin_memberships',{method:'POST',body:JSON.stringify({user_id:fixtureId,role:'admin'})});
 if(!membership.ok)throw new Error('Synthetic staff membership insertion failed');
 await probe('authenticated-staff-read','/v1/admin/'+kind,200,{headers:{Authorization:authorization}},body=>Array.isArray(body?.items));
 phase='fixture-sign-out';
 const signedOut=await backendRequest('/auth/v1/logout?scope=local',publicKey,accessToken,{method:'POST'});
 if(!signedOut.ok)throw new Error('Synthetic session sign-out failed');
}catch{
 failurePhase=phase;
}finally{
 if(fixtureId){
  try{
   const removed=await privilegedRequest('/auth/v1/admin/users/'+fixtureId,{method:'DELETE',body:JSON.stringify({should_soft_delete:false})});
   if(!removed.ok)throw new Error('Synthetic Auth fixture cleanup failed');
   const check=await privilegedRequest('/auth/v1/admin/users/'+fixtureId);
   const membership=await privilegedRequest('/rest/v1/admin_memberships?select=user_id&user_id=eq.'+fixtureId);
   // A transport/server failure with no user is not proof of deletion.
   const notFoundCode=typeof check.body?.code==='string'?check.body.code:check.body?.error_code;
   cleanupConfirmed=check.status===404&&notFoundCode==='user_not_found'&&membership.ok&&Array.isArray(membership.body)&&membership.body.length===0;
   if(!cleanupConfirmed)throw new Error('Synthetic Auth cleanup not confirmed');
  }catch{
   cleanupFailed=true;
  }
 }else if(creationAttempted){
  // A lost/malformed create response cannot establish whether Auth persisted
  // the user. Preserve the email for manual reconciliation; claim no absence.
  cleanupFailed=true;
 }
 const report={site,projectRef:backend.hostname.split('.')[0],testedAt:new Date().toISOString(),cases,passed:failurePhase===null&&!cleanupFailed,failurePhase,creationAttempted,fixtureEmail,cleanupRequired:creationAttempted,cleanupConfirmed,cleanupFailed,scope:'Actual backend HTTP/Auth checks; no browser UI, Storage upload, inquiry delivery or hotel-provider UAT'};
 await mkdir(resolve('scripts/output/production'),{recursive:true});
 await writeFile(resolve('scripts/output/production/hosted-smoke.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
}
if(failurePhase!==null||cleanupFailed)throw new Error('Hosted smoke did not pass');
}
void main().catch(()=>{
 console.error('Hosted smoke failed. Inspect the report if generated; when cleanupFailed is true, reconcile its exact fixtureEmail in private Auth users even if no ID was returned. No credentials logged.');
 process.exitCode=1;
});
