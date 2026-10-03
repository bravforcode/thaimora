import {normalizeTat,tatRows,inBbox,normalizePoi} from "../supabase/functions/_shared/sources";
import {sha256} from "../supabase/functions/_shared/domain";
import {need,rest,upsertPreserving,runSync,fetchSource,quarantine} from "./lib/db";
async function main(){
const source=process.argv[2]??"all",bbox=(process.env.CONTENT_BBOX??"").split(",").map(Number);
if(bbox.length!==4||bbox.some(x=>!Number.isFinite(x)))throw new Error("CONTENT_BBOX=west,south,east,north required");
if(source==="all"||source==="tat")await runSync("tat",async()=>{
  const meta=await fetchSource("https://datacatalog.tat.or.th/api/3/action/package_show?id=tourismactivity");
  if(meta.success!==true||!Array.isArray(meta.result?.resources))throw new Error("TAT metadata schema changed");
  const resource=meta.result.resources.find((r:any)=>r.url?.endsWith("activity.json"));
  if(!resource)throw new Error("TAT activity.json resource missing");
  const version=resource.last_modified??resource.hash??meta.result.metadata_modified;
  const prior=await rest("sync_runs?source=eq.tat&status=eq.completed&order=finished_at.desc&limit=1");
  if(version&&prior[0]?.source_version===version)return {source_version:version,detail:{unchanged:true}};
  const rows=tatRows(await fetchSource(resource.url,120000)),normalized:any[]=[];let errors=0;
  for(const row of rows){try{const event=normalizeTat(row,resource.url);if(!inBbox(event.location,bbox))continue;event.id="tat:"+String(row.ACTIVITYID??row.ID??await sha256([row.NAME,row.STARTDATE,row.ENDDATE,row.LOCATION].join("|")));normalized.push(event);}catch(e){errors++;await quarantine("tat",String(row?.ID??""),e instanceof Error?e.message:"invalid_row",row);}}
  const written=await upsertPreserving("events",normalized);
  return {rows_read:rows.length,rows_written:written,error_count:errors,source_version:version,detail:{rights:"pending; client must approve exact license variant",futureEvents:normalized.filter(r=>Date.parse(r.ends_at)>Date.now()).length}};
});
if(source==="all"||source==="poi")await runSync("geoapify",async()=>{
  const key=need("GEOAPIFY_API_KEY"),url="https://api.geoapify.com/v2/places?categories=tourism,leisure,catering&filter=rect:"+bbox.join(",")+"&limit=500&apiKey="+key;
  const raw=await fetchSource(url);if(!Array.isArray(raw.features))throw new Error("Geoapify schema changed");
  const rows:any[]=[];let errors=0;
  for(const feature of raw.features){try{const row=normalizePoi(feature,"https://apidocs.geoapify.com/docs/places/",process.env.GEOAPIFY_RIGHTS_CONFIRMED==="true");rows.push(row);await rest("osm_pois?on_conflict=id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({id:row.id,payload:feature,source_url:row.source_url,license:row.license,fetched_at:row.fetched_at})});}catch(e){errors++;await quarantine("geoapify",feature?.properties?.place_id??"",e instanceof Error?e.message:"invalid_row",feature);}}
  return {rows_read:raw.features.length,rows_written:await upsertPreserving("pois",rows),error_count:errors,detail:{attribution:"Powered by Geoapify | © OpenStreetMap contributors"}};
});
if(source==="all"||source==="fx")await runSync("frankfurter",async()=>{
  const raw=await fetchSource("https://api.frankfurter.dev/v2/providers/ecb/rates?base=THB");
  if(!Array.isArray(raw)||!raw.length||raw.some(r=>r.base!=="THB"||!/^[A-Z]{3}$/.test(r.quote)||!Number.isFinite(r.rate)||r.rate<=0||!/^\d{4}-\d{2}-\d{2}$/.test(r.date))||new Set(raw.map(r=>r.date)).size!==1||new Set(raw.map(r=>r.quote)).size!==raw.length)throw new Error("Frankfurter ECB schema changed");
  await rest("fx_rates?on_conflict=base",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({base:"THB",rates:Object.fromEntries(raw.map(r=>[r.quote,r.rate])),source:"European Central Bank via Frankfurter v2",as_of:raw[0].date,fetched_at:new Date().toISOString()})});
  return {rows_read:raw.length,rows_written:1};
});
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
