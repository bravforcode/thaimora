import {rest,saveJson} from "./lib/db";
import {publicContent,publicHotel,snapshotProperty} from "../supabase/functions/_shared/domain";
import {licensedContent,homeSettings} from "../supabase/functions/_shared/admin-input";
async function main(){
  const site="thaimora",items:any[]=[];
  const table=site==="thaimora"?"public_properties":"public_hotels";
  for(let offset=0;;offset+=500){const rows=await rest(table+"?select=*&order=id&offset="+offset+"&limit=500");items.push(...rows);if(rows.length<500)break;}
  if(process.env.EXPORT_MODE==="production"&&items.some(r=>r.demo))throw new Error("Production export rejects fixture inventory");
  const pois=await rest("pois?published=eq.true&rights_status=eq.approved&demo=eq.false&select=id,name,description,category,location,zone_id,image,source,source_url,license,rights_status,fetched_at,source_updated_at,website,demo");
  const events=await rest("events?published=eq.true&rights_status=eq.approved&demo=eq.false&ends_at=gt."+encodeURIComponent(new Date().toISOString())+"&select=id,name,description,starts_at,ends_at,location,zone_id,image,source,source_url,license,rights_status,fetched_at,source_updated_at,demo");
  if([...pois,...events].some(row=>!licensedContent(row)))throw new Error("Public content requires source, license, approved rights and non-fixture records");
  const zones=await rest("zones?select=id,slug,name,description,location,geometry,image");
  const settings=site==="taotide"?await rest("site_settings?id=eq.homepage&select=value"):[];
  const snapshot={generatedAt:new Date().toISOString(),mode:process.env.EXPORT_MODE??"preview",[site==="thaimora"?"properties":"hotels"]:items.map(site==="thaimora"?snapshotProperty:publicHotel),pois:pois.map(publicContent),events:events.map(publicContent),zones,...(site==="taotide"?{homeSettings:homeSettings(settings[0]?.value,items.map(row=>row.id))}:{})};
  // No private locations, inquiries, secrets, affiliate click data, or live offers are queried.
  await saveJson(process.argv[2]??"scripts/output/public-content.json",snapshot);
  console.log(JSON.stringify({exported:items.length,pois:pois.length,events:events.length}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
