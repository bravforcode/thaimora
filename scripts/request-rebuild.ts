import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import {need,rest} from "./lib/db";
async function main(){
  const snapshot=JSON.parse(await readFile("scripts/output/public-content.json","utf8"));delete snapshot.generatedAt;
  const hash=createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
  const previous=await rest("sync_runs?source=eq.static-rebuild&status=eq.completed&order=finished_at.desc&limit=1");
  if(previous[0]?.source_version===hash){console.log("Public snapshot unchanged; rebuild skipped");return;}
  const token=need("CLOUDFLARE_API_TOKEN"),account=need("CLOUDFLARE_ACCOUNT_ID"),projects=need("CLOUDFLARE_PROJECT_NAMES").split(",");
  const start=new Date();start.setUTCDate(1);start.setUTCHours(0,0,0,0);let builds=0;
  for(const project of projects){
    if(!/^[a-zA-Z0-9_-]+$/.test(project))throw new Error("Invalid Cloudflare project name");
    for(let page=1;;page++){
      const r=await fetch("https://api.cloudflare.com/client/v4/accounts/"+account+"/pages/projects/"+project+"/deployments?per_page=100&page="+page,{headers:{Authorization:"Bearer "+token},signal:AbortSignal.timeout(10000)});
      if(!r.ok)throw new Error("Cannot verify actual shared Cloudflare build budget");
      const data=await r.json();if(data.success!==true||!Array.isArray(data.result))throw new Error("Cloudflare budget schema changed");
      builds+=data.result.filter((d:any)=>Date.parse(d.created_on)>=start.getTime()).length;
      if(data.result.length<100||data.result.some((d:any)=>Date.parse(d.created_on)<start.getTime()))break;
      if(page>10)throw new Error("Cloudflare pagination verification exceeds safe bound");
    }
  }
  if(builds>=480)throw new Error("Shared Cloudflare 500/month allowance: 20-build reserve reached");
  // Check all Pages projects on this client account, not only the two new sites.
  const list=await fetch("https://api.cloudflare.com/client/v4/accounts/"+account+"/pages/projects",{headers:{Authorization:"Bearer "+token},signal:AbortSignal.timeout(10000)});
  const all=await list.json();if(!list.ok||all.success!==true||!Array.isArray(all.result)||all.result.some((p:any)=>!projects.includes(p.name)))throw new Error("Account has additional projects; shared usage accounting must include them");
  const hook=new URL(need("CLOUDFLARE_BUILD_HOOK"));if(hook.protocol!=="https:"||hook.hostname!=="api.cloudflare.com")throw new Error("Invalid Cloudflare deploy hook");
  const response=await fetch(hook,{method:"POST",signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error("Cloudflare rejected rebuild request");
  await rest("sync_runs",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({source:"static-rebuild",status:"completed",finished_at:new Date().toISOString(),source_version:hash,detail:{observedMonthlyBuilds:builds,requested:true}})});
  console.log(JSON.stringify({requested:true,observedMonthlyBuilds:builds}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
