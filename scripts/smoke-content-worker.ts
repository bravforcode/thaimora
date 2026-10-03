import {createHmac,randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
async function main(){
 const site=process.argv[2];if(!['thaimora','taotide'].includes(site))throw new Error('Selected site required');
 const base=process.env.SUPABASE_URL??'',secret=process.env.CONTENT_SYNC_SECRET??'';
 const expected=site==='thaimora'?'hpjmttoxomdhxxsourih':'yhavmtvzdtvqpylruzfa';
 if(base!=='https://'+expected+'.supabase.co'||!/^[a-f0-9]{64}$/.test(secret))throw new Error('Selected private configuration mismatch');
 const target=base+'/functions/v1/sync-content',cases:{name:string;status:number;passed:boolean}[]=[];
 function signed(stamp:string,nonce:string){return {'X-Content-Timestamp':stamp,'X-Content-Nonce':nonce,'X-Content-Signature':createHmac('sha256',secret).update('content-sync-v1\n'+stamp+'\n'+nonce+'\n'+target).digest('hex')};}
 async function probe(name:string,headers:Record<string,string>,status:number,noop=false){
  const response=await fetch(target,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:'{}',signal:AbortSignal.timeout(15000),redirect:'error'});
  const data=await response.json() as Record<string,unknown>;
  const passed=response.status===status&&(noop?data.claimed===0&&data.completed===0&&data.failed===0:data.error==='unauthorized');
  cases.push({name,status:response.status,passed});if(!passed)throw new Error('Private worker proof failed');
 }
 let failed=false;
 try{
  await probe('anonymous-rejected',{},401);
  await probe('bad-signature-rejected',{'X-Content-Timestamp':String(Math.floor(Date.now()/1000)),'X-Content-Nonce':randomUUID(),'X-Content-Signature':'0'.repeat(64)},401);
  await probe('expired-signature-rejected',signed(String(Math.floor(Date.now()/1000)-120),randomUUID()),401);
  const headers=signed(String(Math.floor(Date.now()/1000)),randomUUID());
  await probe('valid-signed-no-due-work',headers,200,true);
  await probe('signed-nonce-replay-rejected',headers,401);
 }catch{failed=true;}
 const report={site,projectRef:expected,testedAt:new Date().toISOString(),passed:!failed,cases,scope:'Actual private signed worker authorization and replay; no credentials, signature, nonce, request headers or upstream data retained'};
 await mkdir('docs/evidence',{recursive:true});await writeFile('docs/evidence/content-worker-http.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(failed)process.exitCode=1;
}
void main().catch(()=>{console.error('Private worker smoke failed; credential values suppressed');process.exitCode=1;});
