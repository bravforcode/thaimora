import {coordinate,eventInterval,ApiError} from "./domain.ts";
export function tatRows(raw:unknown):any[]{
  if(Array.isArray(raw))return raw;
  if(raw&&typeof raw==="object"){const values=Object.values(raw);const rows=values.find(Array.isArray);if(rows)return rows as any[];}
  throw new ApiError(422,"tat_root_schema_changed");
}
export function normalizeTat(row:any,sourceUrl:string):any{
  if(!row||!row.NAME||!row.STARTDATE||!row.ENDDATE)throw new ApiError(422,"tat_required_fields");
  const pair=String(row.LOCATION??"").split(",").map(v=>Number(v.trim()));
  if(pair.length!==2||pair.some(v=>!Number.isFinite(v)))throw new ApiError(422,"tat_invalid_location");
  const location=coordinate({lat:pair[0],lng:pair[1]});
  const interval=eventInterval(row.STARTDATE,row.ENDDATE);
  return {name:{en:row.NAME_EN||row.NAME,th:row.NAME},description:{en:row.TATEVENTPLACEDETAIL||"",th:row.TATEVENTPLACEDETAIL||""},...interval,location,source:"tat",source_url:sourceUrl,source_updated_at:row.SYSTEMUPDATEDATE?new Date(String(row.SYSTEMUPDATEDATE).replace(" ","T")+"+07:00").toISOString():null,license:null,rights_status:"pending",published:false,demo:false};
}
export function inBbox(p:{lat:number,lng:number},bbox:number[]):boolean{return p.lng>=bbox[0]&&p.lng<=bbox[2]&&p.lat>=bbox[1]&&p.lat<=bbox[3];}
export function normalizePoi(feature:any,url:string,rights=false):any{
  const p=feature?.properties,location=coordinate({lat:p?.lat,lng:p?.lon});
  if(!p?.place_id||!p.name)throw new ApiError(422,"poi_missing_identifier_or_name");
  return {id:"geoapify:"+p.place_id,name:{en:p.name,th:p.name},description:{en:p.formatted??"",th:p.formatted??""},category:p.categories?.[0]??"place",location,source:"geoapify",source_url:url,license:"Geoapify terms; OSM contributors ODbL where applicable",rights_status:rights?"approved":"pending",published:rights,demo:false,fetched_at:new Date().toISOString()};
}
export function licensedOsmRecords(input:any,licenseConfirmed=false):any[]{
 const rows=Array.isArray(input)?input:input?.items??input?.records;
 if(!Array.isArray(rows)||(!licenseConfirmed&&input?.licenseVerified!==true))throw new ApiError(422,"osm_license_review_required");
 const deduped=new Map<string,any>();
 for(const item of rows){
  coordinate(item.location);
  if(item.demo||typeof item.id!=="string"||!/^osm:(node|way|relation):\d+$/.test(item.id)||item.source!=="osm"||!String(item.source_url).startsWith("https://www.openstreetmap.org/")||!String(item.license).includes("ODbL"))throw new ApiError(422,"invalid_licensed_osm_record");
  if(!item.name?.en||!item.name?.th)throw new ApiError(422,"osm_bilingual_name_required");
  const fields=["id","name","description","category","location","zone_id","source","source_url","license","admin_override","fetched_at","source_updated_at"];
  const row=Object.fromEntries(fields.filter(k=>item[k]!==undefined).map(k=>[k,item[k]]));
  row.rights_status="approved";row.published=true;row.demo=false;
  row.fetched_at=item.fetched_at??input.fetchedAt??new Date().toISOString();
  deduped.set(item.id,row);
 }
 return [...deduped.values()];
}
