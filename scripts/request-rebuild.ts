import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {rest} from './lib/db';
import {vercelWorkflowRequest,rebuildState,assertAutomatedRebuildTarget} from './lib/rebuild-target';
async function main(){
  assertAutomatedRebuildTarget(process.env.HOSTING_PROVIDER);
  if(process.env.AUTOMATION_ENABLED!=='true')throw new Error('Vercel automation is not enabled');
  const snapshot=JSON.parse(await readFile('scripts/output/public-content.json','utf8'));delete snapshot.generatedAt;
  const hash=createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
  const previous=await rest('sync_runs?source=eq.static-rebuild&status=eq.completed&order=finished_at.desc&limit=1');
  const pending=await rest('sync_runs?source=eq.static-rebuild&status=eq.running&source_version=eq.'+hash+'&order=started_at.desc&limit=1');
  const state=rebuildState(previous[0],pending[0],hash);
  if(state!=='request'){console.log(JSON.stringify({hostingProvider:'vercel',skipped:state}));return;}
  const request=vercelWorkflowRequest(process.env);
  const response=await fetch(request.url,request.init);
  if(response.status!==204)throw new Error('GitHub rejected gated Vercel deployment workflow request');
  await rest('sync_runs',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({source:'static-rebuild',status:'running',source_version:hash,detail:{hostingProvider:'vercel',requested:true,deployed:false}})});
  console.log(JSON.stringify({requested:true,hostingProvider:'vercel',deployed:false}));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
