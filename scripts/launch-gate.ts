import {readdir,stat} from "node:fs/promises";
import {resolve} from "node:path";
import {rest,readJson} from "./lib/db";
import {launchErrors} from "../supabase/functions/_shared/domain";
import {unsafeExport,privateData} from './lib/export-safety';
async function files(dir:string):Promise<string[]>{const out:string[]=[];for(const item of await readdir(dir,{withFileTypes:true})){const p=resolve(dir,item.name);out.push(...(item.isDirectory()?await files(p):[p]));}return out;}
async function main(){
  const site="thaimora" as "thaimora"|"taotide",e=await readJson(process.argv[2]??"scripts/launch-evidence.json");
  const catalog=await rest((site==="thaimora"?"public_properties":"public_hotels")+"?select=id,demo");
  const pois=await rest("pois?published=eq.true&rights_status=eq.approved&select=id,demo");
  const output=await files("out");
  const evidence={...e,fixtureCount:catalog.filter((r:any)=>r.demo).length+pois.filter((r:any)=>r.demo).length,approvedPropertyCount:site==="thaimora"?catalog.length:0,approvedHotelCount:site==="taotide"?catalog.length:0,approvedPoiCount:pois.length,publicFileCount:output.length};
  const errors=launchErrors(evidence,site);
  if(process.env.NEXT_PUBLIC_DATA_MODE!=="live")errors.push("demo_mode");
  const {readFile}=await import("node:fs/promises");
  const secrets=['SUPABASE_SERVICE_ROLE_KEY','RESEND_API_KEY','TURNSTILE_SECRET_KEY','EMAIL_WORKER_SECRET'].map(key=>process.env[key]??'').filter(Boolean);
  const snapshot=process.env.THAIMORA_SNAPSHOT_PATH;
  if(!snapshot||privateData(await readJson(snapshot)))errors.push('private_or_missing_snapshot');
  for(const file of output.filter(f=>/\.(json|html|js)$/.test(f))){
    const data=await readFile(file,"utf8");
    if(unsafeExport(file,data,secrets))errors.push("private_export:"+file);
  }
  if(errors.length){console.error(JSON.stringify({status:"blocked",errors:[...new Set(errors)]},null,2));process.exitCode=1;}
  else console.log(JSON.stringify({status:"passed",publicFiles:output.length,catalog:catalog.length,pois:pois.length}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
