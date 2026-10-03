import {readJson,rest,runSync,upsertPreserving} from "./lib/db";
import {coordinate,text} from "../supabase/functions/_shared/domain";
import {licensedOsmRecords} from "../supabase/functions/_shared/sources";
async function main(){
 const file=process.argv[2];if(!file)throw new Error("Pass licensed normalized POI JSON path");
 const source=await readJson(file),rows=licensedOsmRecords(source,process.env.POI_LICENSE_CONFIRMED==="true");
 await runSync("licensed-poi-import",async()=>{
  const valid:any[]=[];
  for(const item of rows){
   coordinate(item.location);text(item.source_url,8,2048);text(item.license,3,500);text(item.name?.en);text(item.name?.th);
   if(item.demo||!item.id||item.source!=="osm"||!item.id.startsWith("osm:")||!item.source_url.startsWith("https://www.openstreetmap.org/")||!item.license.includes("ODbL"))throw new Error("Only licensed actual OSM POIs accepted by this adapter");
   const {raw,...row}=item;valid.push({...row,rights_status:"approved",published:true,demo:false,fetched_at:item.fetched_at??source.fetchedAt??new Date().toISOString()});
   await rest("osm_pois?on_conflict=id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({id:row.id,payload:raw??item,source_url:row.source_url,license:row.license,fetched_at:valid.at(-1).fetched_at})});
  }
  return {rows_read:rows.length,rows_written:await upsertPreserving("pois",valid),detail:{license:"ODbL source database stored separately",attribution:"© OpenStreetMap contributors"}};
 });
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
