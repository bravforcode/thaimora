import {ApiError,publicContent,sha256} from "./domain.ts";
import {checkDb,content} from "./runtime.ts";
import {homeSettings} from "./admin-input.ts";

type Scope="full"|"events";
type Reader={meta:()=>Promise<unknown>;content:(scope:Scope)=>Promise<any>;home?:()=>Promise<unknown>;atomicSnapshot?:(scope:Scope)=>Promise<any>};
const cacheHeaders={"Cache-Control":"public, max-age=0, must-revalidate","X-Content-Type-Options":"nosniff"};
function metadata(raw:any):any{
 const versions=["revision","poisVersion","eventsVersion","homeVersion"];
 if(!raw||versions.some(key=>typeof raw[key]!=="string"||!raw[key]||raw[key].length>128)||!Array.isArray(raw.sources)||raw.sources.length>64)
  throw new ApiError(503,"content_metadata_unavailable");
 const timestamp=(value:unknown):string|null=>{
  if(value==null)return null;
  if(typeof value!=="string"||value.length>64||!Number.isFinite(Date.parse(value)))throw new ApiError(503,"content_metadata_unavailable");
  return value;
 };
 const label=(value:unknown):string=>{
  if(typeof value!=="string"||!value||value.length>64)throw new ApiError(503,"content_metadata_unavailable");
  return value;
 };
 // Copy only public operational facts; never return source endpoints or leases.
 return {...Object.fromEntries(versions.map(key=>[key,raw[key]])),nextEventExpiryAt:timestamp(raw.nextEventExpiryAt),sources:raw.sources.map((source:any)=>({
  id:label(source.id),kind:label(source.kind),status:label(source.status),enabled:source.enabled===true,
  checkedAt:timestamp(source.checkedAt),lastSuccessAt:timestamp(source.lastSuccessAt),sourceUpdatedAt:timestamp(source.sourceUpdatedAt),
 }))};
}
async function tag(meta:any,scope:Scope):Promise<string>{
 return 'W/"content-v2-'+scope+'-'+await sha256(JSON.stringify(meta))+'"';
}
function matches(header:string|null,etag:string):boolean{
 if(!header||header.length>4096)return false;
 const weak=(value:string)=>value.trim().replace(/^W\//,"");
 return header.split(",").some(value=>value.trim()==="*"||weak(value)===weak(etag));
}
export async function deliverPublicContent(req:Request,reader:Reader):Promise<Response>{
 const value=new URL(req.url).searchParams.get("scope"),scope:Scope=value===null?"full":value==="events"?"events":(()=>{throw new ApiError(422,"invalid_content_scope");})();
 let meta=metadata(await reader.meta());
 const initialTag=await tag(meta,scope);
 if(matches(req.headers.get("If-None-Match"),initialTag))return new Response(null,{status:304,headers:{...cacheHeaders,ETag:initialTag}});
 if(reader.atomicSnapshot){
  const data=await reader.atomicSnapshot(scope),snapshotMeta=metadata(data?.meta);
  if(!Array.isArray(data.events)||data.events.length>10000||(scope==="full"&&(!Array.isArray(data.pois)||data.pois.length>10000)))throw new ApiError(503,"content_incomplete");
  const payload={...(scope==="full"?{pois:data.pois.map(publicContent)}:{}),events:data.events.map(publicContent),...(scope==="full"&&data.homeSettings!==undefined?{homeSettings:data.homeSettings}:{}),meta:snapshotMeta};
  return new Response(JSON.stringify(payload),{headers:{...cacheHeaders,ETag:await tag(snapshotMeta,scope),"Content-Type":"application/json"}});
 }
 // A source update or expiry during the read must not attach an old validator
 // to new data. Retry once, then fail closed rather than return mixed pages.
 for(let attempt=0;attempt<2;attempt++){
  const [data,home]=await Promise.all([reader.content(scope),scope==="full"&&reader.home?reader.home():Promise.resolve(undefined)]);
  const after=metadata(await reader.meta());
  if(JSON.stringify(meta)!==JSON.stringify(after)){meta=after;continue;}
  const payload={...(scope==="full"?{pois:data.pois.map(publicContent)}:{}),events:data.events.map(publicContent),...(home!==undefined?{homeSettings:home}:{}),meta};
  return new Response(JSON.stringify(payload),{headers:{...cacheHeaders,ETag:await tag(meta,scope),"Content-Type":"application/json"}});
 }
 throw new ApiError(503,"content_changed_during_read");
}
export function publicContentResponse(req:Request,db:any):Promise<Response>{
 return deliverPublicContent(req,{meta:async()=>checkDb(await db.rpc("public_content_meta")),content:scope=>content(db,scope),atomicSnapshot:async scope=>{
  const data=checkDb(await db.rpc("public_content_snapshot",{p_scope:scope}));
  if(data?.homeSettings!==undefined)data.homeSettings=homeSettings(data.homeSettings,data.homeSettings?.featuredHotelIds??[]);
  return data;
 }});
}
