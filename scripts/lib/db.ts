import {readFile,writeFile,mkdir} from "node:fs/promises";
import {resolve} from "node:path";
export function need(key:string):string{const v=process.env[key];if(!v)throw new Error("Missing "+key);return v;}
export async function rest(path:string,init:RequestInit={}):Promise<any>{
  const response=await fetch(need("SUPABASE_URL").replace(/\/$/,"")+"/rest/v1/"+path,{...init,headers:{"apikey":need("SUPABASE_SERVICE_ROLE_KEY"),"Authorization":"Bearer "+need("SUPABASE_SERVICE_ROLE_KEY"),"Content-Type":"application/json",...init.headers},signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error("Database request failed: "+response.status);
  if(response.status===204)return null;
  const payload=await response.text();
  return payload.trim()?JSON.parse(payload):null;
}
export async function upsertPreserving(table:string,rows:any[]):Promise<number>{
  let written=0;
  rows=[...new Map(rows.map(r=>[r.id,r])).values()];
  for(let i=0;i<rows.length;i+=100){
    const batch=rows.slice(i,i+100),ids=batch.map(r=>r.id).filter(Boolean);
    const existing=ids.length?await rest(table+"?select=id,admin_override,rights_status,published&id=in.("+ids.map(encodeURIComponent).join(",")+")"):[];
    const allowed=batch.filter(r=>!existing.find((e:any)=>e.id===r.id&&e.admin_override));
    const protectedRows=allowed.map(r=>{const old=existing.find((e:any)=>e.id===r.id);return old?{...r,rights_status:old.rights_status,published:old.published}:r;});
    if(protectedRows.length)await rest(table+"?on_conflict=id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(protectedRows)});
    written+=protectedRows.length;
  }return written;
}
export async function runSync(source:string,work:(run:any)=>Promise<any>):Promise<void>{
  const [run]=await rest("sync_runs",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({source,status:"running"})});
  try{const result=await work(run);await rest("sync_runs?id=eq."+run.id,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({status:"completed",finished_at:new Date().toISOString(),...result})});console.log(JSON.stringify({source,status:"completed",...result}));}
  catch(e){await rest("sync_runs?id=eq."+run.id,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({status:"failed",finished_at:new Date().toISOString(),detail:{code:"source_or_database_unavailable"}})});throw e;}
}
export async function quarantine(source:string,sourceId:string,reason:string,payload:any):Promise<void>{
  await rest("source_quarantine",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({source,source_id:sourceId,reason,payload})});
}
export async function fetchSource(url:string,timeout=30000):Promise<any>{const r=await fetch(url,{signal:AbortSignal.timeout(timeout)});if(!r.ok)throw new Error("Source unavailable: "+r.status);return r.json();}
export async function saveJson(file:string,value:any):Promise<void>{await mkdir(resolve(file,".."),{recursive:true});await writeFile(file,JSON.stringify(value,null,2)+"\n","utf8");}
export async function readJson(file:string):Promise<any>{return JSON.parse(await readFile(file,"utf8"));}
