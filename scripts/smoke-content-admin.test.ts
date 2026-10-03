import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {basename,dirname,join,resolve} from 'node:path';
import {test} from 'node:test';
import {pathToFileURL} from 'node:url';
const site=basename(process.cwd());assert.ok(['thaimora','taotide'].includes(site));
const script=resolve('scripts/smoke-content-admin.ts'),tsx=pathToFileURL(createRequire(resolve('package.json')).resolve('tsx')).href;
const ref='a'.repeat(20),publicKey='sb_publishable_offline',serviceKey='offline.'+Buffer.from(JSON.stringify({role:'service_role',ref})).toString('base64url')+'.offline';
const accessToken='offline-sensitive-access-token',ownedId='11111111-1111-4111-8111-111111111111',unrelatedId='22222222-2222-4222-8222-222222222222';
const mock=String.raw`
const {writeFileSync}=require('node:fs');
const trace={requests:[],deletedIds:[],cleanupOrder:[],fixtureEmail:null,password:null,eventId:null,auth:false,member:false,event:null,audited:false};
const save=()=>writeFileSync(tracePath,JSON.stringify(trace));
const response=(body,status=200,cors=false)=>new Response(body===null?null:JSON.stringify(body),{status,headers:{'Content-Type':'application/json',...(cors?{'Access-Control-Allow-Origin':'https://smoke.example.invalid'}:{})}});
globalThis.fetch=async(input,init={})=>{
 const url=new URL(String(input)),path=decodeURIComponent(url.pathname),method=init.method??'GET';trace.requests.push(method+' '+url.pathname);save();
 if(path==='/auth/v1/admin/users'&&method==='POST'){
  const body=JSON.parse(init.body);trace.fixtureEmail=body.email;trace.password=body.password;trace.auth=true;save();
  if(mode==='create-timeout'||mode==='reconcile-failure')throw new DOMException('offline-sensitive-create-error','TimeoutError');
  if(mode==='mismatch-identity')return response({id:unrelatedId,email:'unrelated@example.invalid'});
  return response({id:ownedId,email:body.email});
 }
 if(path==='/auth/v1/admin/users'&&method==='GET'){
  if(mode==='reconcile-failure')return response({},503);
  return response({users:[{id:unrelatedId,email:'unrelated@example.invalid'},...(trace.auth?[{id:ownedId,email:trace.fixtureEmail}]:[])]});
 }
 if(path==='/auth/v1/token')return response({access_token:accessToken});
 if(path==='/rest/v1/admin_memberships'){
  if(method==='POST'){trace.member=true;save();return response(null,201);}
  if(method==='DELETE'){trace.cleanupOrder.push('membership');trace.member=false;save();return response(null,204);}
  return response(trace.member?[{user_id:ownedId}]:[]);
 }
 if(path==='/functions/v1/api/v1/admin/events'&&method==='POST'){
  const body=JSON.parse(init.body);if(body.demo!==true||body.published!==false||body.rights_status!=='pending')throw new Error('Fixture must remain private demo');
  trace.eventId=body.id;trace.event={...body,admin_override:mode!=='missing-protection'};save();
  if(mode==='event-timeout')throw new DOMException('offline-sensitive-event-error','TimeoutError');
  return response({item:trace.event},site==='taotide'?201:200,true);
 }
 if(path==='/functions/v1/api/v1/admin/events/'+trace.eventId){
  if(method==='PATCH'){trace.event={...trace.event,...JSON.parse(init.body),admin_override:true};save();return response({item:trace.event},200,true);}
  return response({items:trace.event?[trace.event]:[]},200,true);
 }
 if(path==='/functions/v1/api/v1/admin/events/'+trace.eventId+'/automation'){
  const body=JSON.parse(init.body);if(body.enabled!==true)return response({error:{code:'explicit_automation_release_required'}},422,true);
  trace.event.admin_override=false;trace.audited=mode!=='missing-audit';save();return response({item:{id:trace.eventId,adminOverride:false,automaticSyncEnabled:true}},200,true);
 }
 if(path==='/rest/v1/admin_audit_log')return response(trace.audited?[{actor_id:ownedId,metadata:{automaticSyncEnabled:true,fields:['admin_override']}}]:[]);
 if(path==='/functions/v1/api/v1/content')return response({events:mode==='demo-leak'?[{id:trace.eventId}]:[]},200,true);
 if(path==='/rest/v1/events'){
  if(method==='DELETE'){trace.cleanupOrder.push('event');trace.event=null;save();return response(null,204);}
  return response(trace.event?[{id:trace.eventId}]:[]);
 }
 if(path==='/auth/v1/admin/users/'+ownedId){
  if(method==='DELETE'){trace.deletedIds.push(ownedId);trace.cleanupOrder.push('auth');trace.auth=false;save();return response({id:ownedId});}
  return response({code:'user_not_found'},mode==='cleanup-server-error'?503:404);
 }
 throw new Error('Unexpected offline request; no real fetch fallback');
};
`;
function run(mode:string){
 const temporary=resolve(tmpdir()),directory=mkdtempSync(join(temporary,'content-admin-offline-'));
 try{
  const tracePath=join(directory,'trace.json'),preload=join(directory,'fetch.cjs');
  writeFileSync(preload,'const '+Object.entries({mode,tracePath,accessToken,ownedId,unrelatedId,site}).map(([key,value])=>key+'='+JSON.stringify(value)).join(',')+';'+mock);
  const child=spawnSync(process.execPath,['--import',tsx,'--import',pathToFileURL(preload).href,script,site],{cwd:directory,encoding:'utf8',timeout:20000,env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,SUPABASE_URL:'https://'+ref+'.supabase.co',NEXT_PUBLIC_API_URL:'https://'+ref+'.supabase.co/functions/v1/api',NEXT_PUBLIC_SITE_URL:'https://smoke.example.invalid',NEXT_PUBLIC_SUPABASE_ANON_KEY:publicKey,SUPABASE_SERVICE_ROLE_KEY:serviceKey}});
  assert.ifError(child.error);
  const report=JSON.parse(readFileSync(join(directory,'scripts/output/production/smoke-content-admin.json'),'utf8')),trace=JSON.parse(readFileSync(tracePath,'utf8'));
  for(const value of [serviceKey,accessToken,trace.password,'offline-sensitive-create-error','offline-sensitive-event-error'])assert.ok(!(child.stdout+child.stderr).includes(value),'Safe report cannot include credentials/raw errors');
  assert.match(report.fixtureEmail,/^smoke-content-[0-9a-f-]+@example\.invalid$/);
  return {child,report,trace};
 }finally{assert.equal(dirname(resolve(directory)),temporary);assert.ok(basename(directory).startsWith('content-admin-offline-'));rmSync(directory,{recursive:true,force:true});}
}
test('success proves manual protection, explicit audited release and draft privacy with ordered cleanup',()=>{const {child,report,trace}=run('success');assert.equal(child.status,0);assert.equal(report.passed,true);assert.equal(report.caseCount,7);assert.equal(report.passedCount,7);assert.equal(report.cleanupConfirmed,true);assert.equal(trace.eventId.length,115);assert.ok(trace.eventId.startsWith('content-smoke:'));const encoded=encodeURIComponent(trace.eventId);assert.ok(encoded.includes('%3A'));for(const method of ['PATCH','GET'])assert.ok(trace.requests.includes(method+' /functions/v1/api/v1/admin/events/'+encoded));assert.ok(trace.requests.includes('POST /functions/v1/api/v1/admin/events/'+encoded+'/automation'));assert.deepEqual(trace.cleanupOrder,['event','membership','auth']);assert.equal(trace.auth,false);assert.equal(trace.member,false);assert.equal(trace.event,null);});
test('lost Auth creation response reconciles exact email and cleans persisted fixture',()=>{const {child,report,trace}=run('create-timeout');assert.equal(child.status,1);assert.equal(report.failurePhase,'fixture-create');assert.equal(report.cleanupConfirmed,true);assert.equal(report.cleanup.reconciledCreate,true);assert.deepEqual(trace.deletedIds,[ownedId]);});
test('unrelated create identity is never deleted; exact-email reconciliation finds owned fixture',()=>{const {child,report,trace}=run('mismatch-identity');assert.equal(child.status,1);assert.equal(report.cleanupConfirmed,true);assert.deepEqual(trace.deletedIds,[ownedId]);assert.ok(!trace.deletedIds.includes(unrelatedId));});
test('lost API creation response still deletes exact known event before membership/Auth',()=>{const {child,report,trace}=run('event-timeout');assert.equal(child.status,1);assert.equal(report.failurePhase,'create-forces-manual-override');assert.equal(report.cleanupConfirmed,true);assert.deepEqual(trace.cleanupOrder,['event','membership','auth']);});
test('server failure with user_not_found body does not prove Auth deletion',()=>{const {child,report}=run('cleanup-server-error');assert.equal(child.status,1);assert.equal(report.cleanupFailed,true);assert.equal(report.cleanup.auth,false);});
test('failed reconciliation preserves exact fixture identity and never deletes unrelated users',()=>{const {child,report,trace}=run('reconcile-failure');assert.equal(child.status,1);assert.equal(report.cleanupFailed,true);assert.equal(report.cleanup.auth,false);assert.deepEqual(trace.deletedIds,[]);assert.equal(report.fixtureEmail,trace.fixtureEmail);});
for(const [mode,phase] of [['missing-protection','create-forces-manual-override'],['missing-audit','release-audit-verified'],['demo-leak','public-content-excludes-draft-demo']])test(mode+' cannot pass smoke and all fixtures are cleaned',()=>{const {child,report}=run(mode);assert.equal(child.status,1);assert.equal(report.failurePhase,phase);assert.equal(report.passed,false);assert.equal(report.cleanupConfirmed,true);});
