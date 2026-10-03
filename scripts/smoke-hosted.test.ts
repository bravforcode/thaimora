import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {basename,dirname,join,resolve} from 'node:path';
import {test} from 'node:test';
import {pathToFileURL} from 'node:url';

const site=basename(process.cwd());
assert.ok(['thaimora','taotide'].includes(site),'Run from the project root');
const script=resolve('scripts/smoke-hosted.ts');
const tsx=pathToFileURL(createRequire(resolve('package.json')).resolve('tsx')).href;
const projectRef='a'.repeat(20),publicKey='sb_publishable_offline_fixture';
const serviceKey='offline.'+Buffer.from(JSON.stringify({role:'service_role',ref:projectRef})).toString('base64url')+'.offline';
const accessToken='offline-sensitive-access-token';
const fixtureId='11111111-1111-4111-8111-111111111111';

// The child installs a complete fetch replacement before loading the executable.
// Unknown requests throw; this harness never falls back to a real network fetch.
const offlineFetch=String.raw`
const {writeFileSync}=require('node:fs');
const trace={requests:[],fixtureEmail:null,password:null,deletedIds:[]};
let member=false;
const save=()=>writeFileSync(tracePath,JSON.stringify(trace));
const response=(body,status=200,cors=false)=>new Response(body===null?null:JSON.stringify(body),{
 status,headers:{'Content-Type':'application/json',...(cors?{'Access-Control-Allow-Origin':'https://smoke-tests.invalid'}:{})}
});
globalThis.fetch=async (input,init={})=>{
 const url=new URL(String(input)),path=url.pathname,method=init.method??'GET',headers=new Headers(init.headers);
 trace.requests.push(method+' '+path);save();
 if(path==='/rest/v1/zones')return response([]);
 if(path==='/functions/v1/api/v1/content'){
  if(headers.get('Origin')==='https://foreign-origin.invalid')return response({},403);
  return method==='OPTIONS'?response(null,204,true):response({pois:[],events:[]},200,true);
 }
 if(path==='/functions/v1/api/v1/properties')return response({items:[]},200,true);
 if(path==='/functions/v1/api/v1/zones')return response({items:Array.from({length:8},()=>({}))},200,true);
 if(path.startsWith('/functions/v1/api/v1/admin/')){
  const authorized=headers.get('Authorization')==='Bearer '+accessToken;
  return response(authorized?(member?{items:[]}:{error:{code:'admin_required'}}):{error:{code:'unauthorized'}},authorized?(member?200:403):401,true);
 }
 if(path.startsWith('/rest/v1/')&&headers.get('apikey')===publicKey)return response({code:'42501'},401);
 if(path==='/auth/v1/admin/users'&&method==='POST'){
  const body=JSON.parse(init.body);trace.fixtureEmail=body.email;trace.password=body.password;save();
  if(mode==='timeout')throw new DOMException('offline-sensitive-create-error','TimeoutError');
  if(mode==='malformed')return new Response('{',{status:200});
  if(mode==='mismatch-email')return response({id:fixtureId,email:'unrelated@tests.invalid'});
  return response({id:fixtureId,email:body.email},mode==='failed-create-with-id'?503:200);
 }
 if(path==='/auth/v1/token')return response({access_token:accessToken});
 if(path==='/auth/v1/logout')return response(null,204);
 if(path==='/rest/v1/admin_memberships'){
  if(method==='POST'){member=true;return response(null,201);}
  return response([]);
 }
 if(path==='/auth/v1/admin/users/'+fixtureId){
  if(method==='DELETE'){trace.deletedIds.push(fixtureId);member=false;save();return response({id:fixtureId});}
  return response({code:'user_not_found'},mode==='cleanup-failure'?503:404);
 }
 throw new Error('Unexpected offline request');
};
`;

function run(mode:string){
 const tempRoot=resolve(tmpdir()),directory=mkdtempSync(join(tempRoot,'hosted-smoke-offline-'));
 try{
  const tracePath=join(directory,'trace.json'),preload=join(directory,'offline-fetch.cjs');
  writeFileSync(preload,'const '+Object.entries({mode,tracePath,publicKey,accessToken,fixtureId}).map(([key,value])=>key+'='+JSON.stringify(value)).join(',')+';'+offlineFetch);
  const child=spawnSync(process.execPath,['--import',tsx,'--import',pathToFileURL(preload).href,script,site],{
   cwd:directory,encoding:'utf8',timeout:15000,
   env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,SUPABASE_URL:'https://'+projectRef+'.supabase.co',
    NEXT_PUBLIC_API_URL:'https://'+projectRef+'.supabase.co/functions/v1/api',NEXT_PUBLIC_SITE_URL:'https://smoke-tests.invalid',
    NEXT_PUBLIC_SUPABASE_ANON_KEY:publicKey,SUPABASE_SERVICE_ROLE_KEY:serviceKey}
  });
  assert.ifError(child.error);
  const report=JSON.parse(readFileSync(join(directory,'scripts/output/production/hosted-smoke.json'),'utf8'));
  const trace=JSON.parse(readFileSync(tracePath,'utf8'));
  const output=child.stdout+child.stderr;
  for(const secret of [serviceKey,accessToken,trace.password,'offline-sensitive-create-error'])assert.ok(!output.includes(secret),'Report must omit credentials and raw errors');
  assert.equal(report.creationAttempted,true);
  assert.equal(report.cleanupRequired,true);
  assert.equal(report.fixtureEmail,trace.fixtureEmail);
  assert.match(report.fixtureEmail,/^smoke-[0-9a-f-]+@tests[.]invalid$/);
  return {child,report,trace};
 }finally{
  assert.equal(dirname(resolve(directory)),tempRoot,'Cleanup must stay in the named temporary root');
  assert.ok(basename(directory).startsWith('hosted-smoke-offline-'));
  rmSync(directory,{recursive:true,force:true});
 }
}

for(const mode of ['timeout','malformed','mismatch-email']){
 test('uncertain '+mode+' creation requires exact-email reconciliation',()=>{
  const {child,report,trace}=run(mode);
  assert.equal(child.status,1);assert.equal(report.passed,false);
  assert.equal(report.failurePhase,'fixture-create');
  assert.equal(report.cleanupFailed,true);assert.equal(report.cleanupConfirmed,false);
  assert.deepEqual(trace.deletedIds,[],'Do not delete an unknown or unrelated identity');
  assert.match(child.stderr,/reconcile its exact fixtureEmail.*even if no ID was returned/);
 });
}
test('an error response with this exact email and valid ID is still cleaned up',()=>{
 const {child,report,trace}=run('failed-create-with-id');
 assert.equal(child.status,1);assert.equal(report.passed,false);
 assert.equal(report.failurePhase,'fixture-create');
 assert.equal(report.cleanupFailed,false);assert.equal(report.cleanupConfirmed,true);
 assert.deepEqual(trace.deletedIds,[fixtureId]);
});
test('normal successful run preserves confirmed cleanup',()=>{
 const {child,report,trace}=run('success');
 assert.equal(child.status,0);assert.equal(report.passed,true);
 assert.equal(report.failurePhase,null);
 assert.equal(report.cleanupFailed,false);assert.equal(report.cleanupConfirmed,true);
 assert.equal(report.cases.length,13);assert.ok(report.cases.every((item:{passed:boolean})=>item.passed));
 assert.deepEqual(trace.deletedIds,[fixtureId]);
});
test('cleanup server failure cannot prove deletion despite user_not_found body',()=>{
 const {child,report,trace}=run('cleanup-failure');
 assert.equal(child.status,1);assert.equal(report.passed,false);
 assert.equal(report.cleanupFailed,true);assert.equal(report.cleanupConfirmed,false);
 assert.deepEqual(trace.deletedIds,[fixtureId]);
});
