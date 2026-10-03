import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {vercelWorkflowRequest,rebuildState,vercelDeploymentReceipt,assertAutomatedRebuildTarget} from './lib/rebuild-target';
test('dispatch is pinned to GitHub workflow in configured repository and explicit ref',()=>{
  const r=vercelWorkflowRequest({GITHUB_REPOSITORY:'client/site',GITHUB_DEPLOY_REF:'main',GITHUB_DEPLOY_TOKEN:'fake-private-token'});
  assert.equal(r.url,'https://api.github.com/repos/client/site/actions/workflows/deploy-vercel.yml/dispatches');
  assert.equal(r.init.method,'POST');assert.deepEqual(JSON.parse(r.init.body),{ref:'main'});
});
test('missing target/secret fails without returning secret value',()=>{
  assert.throws(()=>vercelWorkflowRequest({}),/GITHUB_REPOSITORY/);
  assert.throws(()=>vercelWorkflowRequest({GITHUB_REPOSITORY:'client/site'}),/GITHUB_DEPLOY_REF/);
  assert.throws(()=>vercelWorkflowRequest({GITHUB_REPOSITORY:'client/site',GITHUB_DEPLOY_REF:'main'}),/GITHUB_DEPLOY_TOKEN/);
});
test('external URL or invalid branch cannot become dispatch target',()=>{
  const base={GITHUB_REPOSITORY:'client/site',GITHUB_DEPLOY_REF:'main',GITHUB_DEPLOY_TOKEN:'fake-private-token'};
  assert.throws(()=>vercelWorkflowRequest({...base,GITHUB_REPOSITORY:'https://evil.test/repo'}),/GITHUB_REPOSITORY/);
  assert.throws(()=>vercelWorkflowRequest({...base,GITHUB_DEPLOY_REF:'--anything'}),/GITHUB_DEPLOY_REF/);
  assert.throws(()=>vercelWorkflowRequest({...base,GITHUB_DEPLOY_REF:'../../other'}),/GITHUB_DEPLOY_REF/);
});
test('accepted but failed dispatch never makes an unchanged source look deployed',()=>{
  const now=Date.parse('2026-10-03T12:00:00Z');
  const oldRequest={status:'completed',source_version:'hash',detail:{deployed:false}};
  assert.equal(rebuildState(oldRequest,undefined,'hash',now),'request');
  assert.equal(rebuildState({...oldRequest,detail:{deployed:true}},undefined,'hash',now),'completed');
  assert.equal(rebuildState(undefined,{status:'running',source_version:'hash',started_at:'2026-10-03T11:50:00Z'},'hash',now),'inflight');
  assert.equal(rebuildState(undefined,{status:'running',source_version:'hash',started_at:'2026-10-03T11:20:00Z'},'hash',now),'request');
  assert.equal(rebuildState(undefined,{status:'failed',source_version:'hash',started_at:'2026-10-03T11:50:00Z'},'hash',now),'request');
});
test('only an actual successful deployment receipt certifies its captured snapshot hash',()=>{
  const hash='a'.repeat(64),otherHash='b'.repeat(64);
  const receipt=vercelDeploymentReceipt(hash,new Date('2026-10-03T12:00:00Z'));
  assert.equal(rebuildState(receipt,undefined,hash),'completed');
  assert.equal(rebuildState(receipt,undefined,otherHash),'request');
  assert.throws(()=>vercelDeploymentReceipt('wrong'),/Invalid deployed snapshot hash/);
});
test('legacy Cloudflare hook automation stops before any request or completion record',()=>{
  assert.throws(()=>assertAutomatedRebuildTarget('cloudflare'),/use gated manual deploy:cloudflare or verified Vercel workflow; legacy hook completion unsupported/);
  assert.throws(()=>assertAutomatedRebuildTarget(undefined),/Select the verified HOSTING_PROVIDER/);
  assert.doesNotThrow(()=>assertAutomatedRebuildTarget('vercel'));
  const result=spawnSync(process.execPath,['--import','tsx',fileURLToPath(new URL('./request-rebuild.ts',import.meta.url))],{
    cwd:fileURLToPath(new URL('..',import.meta.url)),env:{HOSTING_PROVIDER:'cloudflare'},encoding:'utf8',timeout:10000,
  });
  assert.equal(result.status,1);
  assert.match(result.stderr,/use gated manual deploy:cloudflare or verified Vercel workflow; legacy hook completion unsupported/);
});
