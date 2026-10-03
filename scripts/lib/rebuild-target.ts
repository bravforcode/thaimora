export function assertAutomatedRebuildTarget(provider:string|undefined){
  if(provider==='cloudflare')throw new Error('use gated manual deploy:cloudflare or verified Vercel workflow; legacy hook completion unsupported');
  if(provider!=='vercel')throw new Error('Select the verified HOSTING_PROVIDER explicitly');
}
export function rebuildState(completed:any,pending:any,hash:string,now=Date.now()):'completed'|'inflight'|'request'{
  if(completed?.status==='completed'&&completed.source_version===hash&&completed.detail?.deployed===true)return 'completed';
  const started=Date.parse(pending?.started_at??'');
  if(pending?.status==='running'&&pending.source_version===hash&&Number.isFinite(started)&&started<=now&&now-started<30*60*1000)return 'inflight';
  return 'request';
}
export function vercelDeploymentReceipt(hash:string,now=new Date()){
  if(!/^[a-f0-9]{64}$/.test(hash))throw new Error('Invalid deployed snapshot hash');
  return {source:'static-rebuild',status:'completed',source_version:hash,finished_at:now.toISOString(),detail:{hostingProvider:'vercel',deployed:true}};
}
export function vercelWorkflowRequest(env:NodeJS.ProcessEnv){
  const repository=env.GITHUB_REPOSITORY,ref=env.GITHUB_DEPLOY_REF,token=env.GITHUB_DEPLOY_TOKEN;
  if(!repository||!/^[-a-zA-Z0-9]+\/[a-zA-Z0-9_.-]+$/.test(repository))throw new Error('Missing/invalid GITHUB_REPOSITORY');
  if(!ref||!/^[-a-zA-Z0-9_./]+$/.test(ref)||ref.startsWith('-')||ref.includes('..'))throw new Error('Missing/invalid GITHUB_DEPLOY_REF');
  if(!token)throw new Error('Missing GITHUB_DEPLOY_TOKEN');
  return {
    url:'https://api.github.com/repos/'+repository+'/actions/workflows/deploy-vercel.yml/dispatches',
    init:{method:'POST',headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'},body:JSON.stringify({ref}),signal:AbortSignal.timeout(10000)},
  };
}
