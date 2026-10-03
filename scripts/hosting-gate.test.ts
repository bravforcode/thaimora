import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hostingErrors} from '../supabase/functions/_shared/hosting';
const now=Date.parse('2026-10-03T12:00:00Z');
const proof={hostingProvider:'vercel',hostingPlan:'pro',hostingPlanVerified:true,commercialHostingAllowed:true,hostingUsageVerified:true,hostingUsageObservedAt:'2026-10-03T11:00:00Z',hostingUsageEvidence:'synthetic-readonly-receipt',observedMonthlyDeploymentCount:10};
test('reviewed current commercial-plan observation passes without claiming live verification',()=>{
  assert.deepEqual(hostingErrors(proof,now),[]);
  assert.deepEqual(hostingErrors({...proof,hostingProvider:'cloudflare',hostingPlan:'free',monthlyBuildCount:100},now),[]);
});
test('Hobby, missing or unknown host cannot satisfy commercial launch even with true approval flags',()=>{
  assert(hostingErrors({...proof,hostingPlan:'hobby'},now).includes('vercel_commercial_plan'));
  assert(hostingErrors({...proof,hostingProvider:'unknown'},now).includes('hosting_provider'));
  assert(hostingErrors({...proof,commercialHostingAllowed:false},now).includes('commercial_hosting_not_verified'));
});
test('old, future or unsupported usage assertion fails closed',()=>{
  assert(hostingErrors({...proof,hostingUsageObservedAt:'2026-10-01T11:00:00Z'},now).includes('hosting_usage_observation_stale'));
  assert(hostingErrors({...proof,hostingUsageObservedAt:'2026-10-04T11:00:00Z'},now).includes('hosting_usage_observation_stale'));
  assert(hostingErrors({...proof,hostingUsageEvidence:''},now).includes('hosting_usage_not_verified'));
});
test('Vercel internal reserve and Cloudflare documented cap stay separate',()=>{
  assert(hostingErrors({...proof,observedMonthlyDeploymentCount:480},now).includes('internal_deployment_reserve'));
  assert(!hostingErrors({...proof,observedMonthlyDeploymentCount:480},now).includes('cloudflare_build_limit'));
  assert(hostingErrors({...proof,hostingProvider:'cloudflare',hostingPlan:'free',monthlyBuildCount:501},now).includes('cloudflare_build_limit'));
  assert(hostingErrors({...proof,observedMonthlyDeploymentCount:-1},now).includes('internal_deployment_reserve'));
});
