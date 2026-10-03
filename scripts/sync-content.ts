// CLI and scheduler use the same private leases and atomic writes.
async function main(){
 const base=process.env.SUPABASE_URL,secret=process.env.CONTENT_SYNC_SECRET;
 if(!base||!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(base)||!secret||!/^[a-f0-9]{64}$/.test(secret))throw new Error('Protected Supabase URL and CONTENT_SYNC_SECRET required');
 if(process.argv[2]&&!['all','fx','tat'].includes(process.argv[2]))throw new Error('Unsupported source; configure approved sources in the private registry');
 const response=await fetch(base+'/functions/v1/sync-content',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+secret},body:'{}',signal:AbortSignal.timeout(90000),redirect:'error'});
 if(!response.ok)throw new Error('Content worker failed: '+response.status);
 const result=await response.json();console.log(JSON.stringify({claimed:result.claimed,completed:result.completed,failed:result.failed}));
 if(result.failed)process.exitCode=1;
}
main().catch(()=>{console.error('Content sync failed; inspect private source status without printing secrets');process.exitCode=1;});
