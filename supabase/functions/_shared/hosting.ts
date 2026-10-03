// Reviewed observations only. Do not infer billing, rights or usage from a key.
export function hostingErrors(e:any,now=Date.now()):string[]{
  const errors:string[]=[];
  if(!['vercel','cloudflare'].includes(e?.hostingProvider))return ['hosting_provider'];
  if(e.hostingPlanVerified!==true)errors.push('hosting_plan_not_verified');
  if(e.commercialHostingAllowed!==true)errors.push('commercial_hosting_not_verified');
  if(e.hostingProvider==='vercel'){
    if(!['pro','enterprise'].includes(String(e.hostingPlan??'').toLowerCase()))errors.push('vercel_commercial_plan');
    // Internal project cap with 20-record reserve; not a Vercel plan allowance.
    if(!Number.isInteger(e.observedMonthlyDeploymentCount)||e.observedMonthlyDeploymentCount<0||e.observedMonthlyDeploymentCount>=480)errors.push('internal_deployment_reserve');
  }else{
    if(e.hostingPlan!=='free')errors.push('cloudflare_free_plan');
    if(!Number.isInteger(e.monthlyBuildCount)||e.monthlyBuildCount<0||e.monthlyBuildCount>500)errors.push('cloudflare_build_limit');
  }
  const observed=Date.parse(e.hostingUsageObservedAt??'');
  if(e.hostingUsageVerified!==true||typeof e.hostingUsageEvidence!=='string'||e.hostingUsageEvidence.trim().length<8)errors.push('hosting_usage_not_verified');
  if(!Number.isFinite(observed)||observed>now||now-observed>86400000)errors.push('hosting_usage_observation_stale');
  return errors;
}
