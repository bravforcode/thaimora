import {need} from "./lib/db";
async function main(){
 const token=need("GITHUB_BUDGET_TOKEN"),repos=need("GITHUB_BUDGET_REPOSITORIES").split(","),headers={Authorization:"Bearer "+token,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"};
 const start=new Date();start.setUTCDate(1);start.setUTCHours(0,0,0,0);let minutes=0,artifactBytes=0;
 for(const repo of repos){
  if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo))throw new Error("Invalid GitHub repository");
  for(let page=1;;page++){
   const response=await fetch("https://api.github.com/repos/"+repo+"/actions/runs?per_page=100&page="+page+"&created=>="+encodeURIComponent(start.toISOString()),{headers,signal:AbortSignal.timeout(15000)});
   const data=await response.json();if(!response.ok||!Array.isArray(data.workflow_runs))throw new Error("Cannot audit shared GitHub Actions usage");
   for(const run of data.workflow_runs){
    const timing=await fetch("https://api.github.com/repos/"+repo+"/actions/runs/"+run.id+"/timing",{headers,signal:AbortSignal.timeout(15000)});
    const t=await timing.json();if(!timing.ok||!t.billable)throw new Error("Missing verified GitHub billable timing");
    for(const [platform,v]of Object.entries(t.billable) as [string,any][]){const multiplier=platform==="MACOS"?10:platform==="WINDOWS"?2:1;minutes+=Math.ceil((v.total_ms??0)/60000)*multiplier;}
   }
   if(data.workflow_runs.length<100)break;if(page>20)throw new Error("Actions usage exceeds auditable paging bound");
  }
  for(let page=1;;page++){
   const response=await fetch("https://api.github.com/repos/"+repo+"/actions/artifacts?per_page=100&page="+page,{headers,signal:AbortSignal.timeout(15000)});
   const data=await response.json();if(!response.ok||!Array.isArray(data.artifacts))throw new Error("Cannot audit shared artifact storage");
   artifactBytes+=data.artifacts.filter((a:any)=>!a.expired).reduce((sum:number,a:any)=>sum+a.size_in_bytes,0);
   if(data.artifacts.length<100)break;if(page>20)throw new Error("Artifact usage exceeds auditable paging bound");
  }
 }
 if(minutes>=1800||artifactBytes>=450*1024*1024)throw new Error("Shared GitHub Free reserve reached");
 console.log(JSON.stringify({observedBillableMinutes:minutes,observedArtifactBytes:artifactBytes,reserveMinutes:200,reserveStorageMiB:50}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
