import {readJson,rest,runSync,upsertPreserving} from "./lib/db";
import {coordinate,text} from "../supabase/functions/_shared/domain";
import {licensedOsmRecords} from "../supabase/functions/_shared/sources";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
export async function importPois(source:any,licenseConfirmed=false):Promise<void>{
 const rows=licensedOsmRecords(source,licenseConfirmed);
 const valid=rows.map(item=>{
   coordinate(item.location);text(item.source_url,8,2048);text(item.license,3,500);text(item.name?.en);text(item.name?.th);
   if(item.demo||!item.id||item.source!=="osm"||!item.id.startsWith("osm:")||!item.source_url.startsWith("https://www.openstreetmap.org/")||!item.license.includes("ODbL"))throw new Error("Only licensed actual OSM POIs accepted by this adapter");
   const {raw,...row}=item;return {...row,rights_status:"approved",published:true,demo:false,fetched_at:item.fetched_at??source.fetchedAt??new Date().toISOString()};
 });
 await runSync("licensed-poi-import",async()=>{
  for(let i=0;i<valid.length;i+=100){
   const batch=valid.slice(i,i+100).map((row,index)=>({id:row.id,payload:rows[i+index].raw??rows[i+index],source_url:row.source_url,license:row.license,fetched_at:row.fetched_at}));
   await rest("osm_pois?on_conflict=id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(batch)});
  }
  return {rows_read:rows.length,rows_written:await upsertPreserving("pois",valid),detail:{license:"ODbL source database stored separately",attribution:"© OpenStreetMap contributors"}};
 });
}
async function main(){
 const file=process.argv[2];if(!file)throw new Error("Pass licensed normalized POI JSON path");
 await importPois(await readJson(file),process.env.POI_LICENSE_CONFIRMED==="true");
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.message);process.exitCode=1;});
