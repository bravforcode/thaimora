// Visitor routes never fetch upstream data. Only leased, fixed registry sources run here.
export type SourceClaim = { id:string; kind:string; endpoint:string|null; lease:string; version:string|null; etag:string|null; rightsConfirmed:boolean; publicSourceUrl:string|null; license:string|null; bbox:number[]|null };
type RpcDb = { rpc:(name:string,args:Record<string,unknown>)=>{abortSignal:(signal:AbortSignal)=>PromiseLike<{data:unknown;error:unknown}>} };
export class SyncError extends Error { constructor(public code:string){super(code);} }
const ECB_URL='https://api.frankfurter.dev/v2/providers/ecb/rates?base=THB';
const TAT_URL='https://datacatalog.tat.or.th/api/3/action/package_show?id=tourismactivity';
export async function boundedJson(url:string,fetcher:typeof fetch=fetch,etag?:string|null,maxBytes=1_000_000):Promise<{body:unknown;etag:string|null;unchanged:boolean}> {
 let response:Response;
 try { response=await fetcher(url,{headers:{Accept:'application/json',...(etag?{'If-None-Match':etag}:{})},redirect:'error',signal:AbortSignal.timeout(20000)}); }
 catch(e){throw new SyncError(e instanceof Error && (e.name==='TimeoutError'||e.name==='AbortError')?'upstream_timeout':'upstream_unavailable');}
 if(response.status===304)return {body:null,etag:etag??null,unchanged:true};
 if(!response.ok)throw new SyncError('upstream_unavailable');
 const announced=Number(response.headers.get('Content-Length'));
 if(Number.isFinite(announced)&&announced>maxBytes){await response.body?.cancel();throw new SyncError('source_too_large');}
 if(!response.body)throw new SyncError('invalid_source');
 const reader=response.body.getReader();const chunks:Uint8Array[]=[];let size=0;
 try {
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw new SyncError('source_too_large');}chunks.push(value);}
 } catch(e){if(e instanceof SyncError)throw e;throw new SyncError(e instanceof Error && (e.name==='TimeoutError'||e.name==='AbortError')?'upstream_timeout':'upstream_unavailable');}
 finally {reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 let body:unknown;try{body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new SyncError('invalid_source');}
 const nextEtag=response.headers.get('ETag');
 return {body,etag:nextEtag&&nextEtag.length<=200?nextEtag:null,unchanged:false};
}
export function ecbBatch(raw:unknown):{version:string;sourceUpdatedAt:null;fx:Record<string,unknown>;rowsRead:number} {
 if(!Array.isArray(raw)||raw.length<1||raw.length>64)throw new SyncError('invalid_source');
 const dates=new Set<string>(),quotes=new Set<string>(),rates:Record<string,number>={};
 for(const row of raw){
  if(!row||row.base!=='THB'||typeof row.quote!=='string'||!/^[A-Z]{3}$/.test(row.quote)||typeof row.rate!=='number'||!Number.isFinite(row.rate)||row.rate<=0||typeof row.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(row.date)||Number.isNaN(Date.parse(row.date))||quotes.has(row.quote))throw new SyncError('invalid_source');
  dates.add(row.date);quotes.add(row.quote);rates[row.quote]=row.rate;
 }
 if(dates.size!==1)throw new SyncError('invalid_source');const date=[...dates][0];
 return {version:date,sourceUpdatedAt:null,fx:{base:'THB',rates,as_of:date},rowsRead:raw.length};
}
export function tatMetadata(raw:unknown):{version:string;sourceUpdatedAt:string|null} {
 const obj=raw as {success?:boolean;result?:{resources?:Array<{url?:string;last_modified?:string;hash?:string}>;metadata_modified?:string}};
 if(obj?.success!==true||!Array.isArray(obj.result?.resources))throw new SyncError('invalid_source');
 const resource=obj.result.resources.find(r=>r.url?.endsWith('/activity.json'));
 if(!resource)throw new SyncError('invalid_source');
 const version=resource.last_modified??resource.hash??obj.result.metadata_modified;
 if(typeof version!=='string'||version.length<1||version.length>128)throw new SyncError('invalid_source');
 const rawDate=resource.last_modified;const stamp=rawDate?rawDate+(/(Z|[+-]\d{2}:\d{2})$/.test(rawDate)?'':'Z'):null;
 const sourceUpdatedAt=stamp&&!Number.isNaN(Date.parse(stamp))?new Date(stamp).toISOString():null;
 return {version,sourceUpdatedAt}; // Catalog metadata success never grants event publication rights.
}
export function organizerBatch(raw:unknown,source:SourceClaim):{version:string;sourceUpdatedAt:string|null;rows:Record<string,unknown>[];rowsRead:number} {
 const obj=raw as {complete?:boolean;version?:string;updatedAt?:string;events?:Array<Record<string,unknown>>};
 if(!source.rightsConfirmed||!source.license||!source.publicSourceUrl||obj?.complete!==true||typeof obj.version!=='string'||obj.version.length<1||obj.version.length>128||!Array.isArray(obj.events)||obj.events.length>500||!Array.isArray(source.bbox)||source.bbox.length!==4||source.bbox.some(v=>!Number.isFinite(v)))throw new SyncError('invalid_source');
 const rows=new Map<string,Record<string,unknown>>();
 const seen=new Set<string>();
 for(const e of obj.events){
  if(typeof e.id!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(e.id)||seen.has(e.id)||(e.status!==undefined&&e.status!=='scheduled'&&e.status!=='cancelled'))throw new SyncError('invalid_source');
  seen.add(e.id);if(e.status==='cancelled')continue;
  const name=e.name as {en?:unknown;th?:unknown},location=e.location as {lat?:unknown;lng?:unknown};
  if(typeof e.id!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(e.id)||typeof name?.en!=='string'||typeof name?.th!=='string'||!name.en.trim()||!name.th.trim()||name.en.length>300||name.th.length>300||typeof location?.lat!=='number'||typeof location?.lng!=='number'||!Number.isFinite(location.lat)||!Number.isFinite(location.lng)||location.lat<source.bbox[1]||location.lat>source.bbox[3]||location.lng<source.bbox[0]||location.lng>source.bbox[2]||typeof e.startsAt!=='string'||typeof e.endsAt!=='string'||!/(Z|[+-]\d{2}:\d{2})$/.test(e.startsAt)||!/(Z|[+-]\d{2}:\d{2})$/.test(e.endsAt)||!Number.isFinite(Date.parse(e.startsAt))||!Number.isFinite(Date.parse(e.endsAt))||Date.parse(e.endsAt)<=Date.parse(e.startsAt))throw new SyncError('invalid_source');
  const id='organizer-json:'+e.id;if(rows.has(id))throw new SyncError('invalid_source');
  const desc=e.description as {en?:unknown;th?:unknown}|undefined;
  rows.set(id,{id,name:{en:name.en,th:name.th},description:{en:typeof desc?.en==='string'?desc.en.slice(0,5000):'',th:typeof desc?.th==='string'?desc.th.slice(0,5000):''},location:{lat:location.lat,lng:location.lng},starts_at:new Date(e.startsAt).toISOString(),ends_at:new Date(e.endsAt).toISOString()});
 }
 const updated=obj.updatedAt;
 if(updated!==undefined&&(typeof updated!=='string'||!/(Z|[+-]\d{2}:\d{2})$/.test(updated)||!Number.isFinite(Date.parse(updated))))throw new SyncError('invalid_source');
 return {version:obj.version,sourceUpdatedAt:updated?new Date(updated).toISOString():null,rows:[...rows.values()],rowsRead:obj.events.length};
}
export function safeOrganizerHost(host:string):boolean {
 return host.length<=253 && /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host)
 && !/(?:^|\.)(localhost|local|internal|test|example|invalid|onion|home|lan|corp|arpa)$/.test(host);
}
export function publicAddress(address:string):boolean {
 if(address.includes('.')){
  if(!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(address))return false;
  const a=address.split('.').map(Number);if(a.some(v=>v>255))return false;
  return !(a[0]===0||a[0]===10||a[0]===127||a[0]>=224||(a[0]===100&&a[1]>=64&&a[1]<=127)||(a[0]===169&&a[1]===254)||(a[0]===172&&a[1]>=16&&a[1]<=31)||(a[0]===192&&(a[1]===168||a[1]===0||a[1]===88))||(a[0]===198&&(a[1]===18||a[1]===19||(a[1]===51&&a[2]===100)))||(a[0]===203&&a[1]===0&&a[2]===113));
 }
 const parts=address.toLowerCase().split('::');if(parts.length>2)return false;
 const left=parts[0]?parts[0].split(':'):[],right=parts.length===2&&parts[1]?parts[1].split(':'):[];
 if([...left,...right].some(v=>!/^[0-9a-f]{1,4}$/.test(v))||(parts.length===1&&left.length!==8)||(parts.length===2&&left.length+right.length>=8))return false;
 const values=[...left,...Array(parts.length===2?8-left.length-right.length:0).fill('0'),...right].map(v=>parseInt(v,16));
 return values[0]>=0x2000&&values[0]<=0x3fff&&values[0]!==0x2002&&!(values[0]===0x2001&&(values[1]===0||values[1]===0xdb8||(values[1]>=0x10&&values[1]<=0x2f)));
}
export async function checkedEndpoint(source:SourceClaim,organizerConfig?:{host:string;egressVerified:boolean},resolver:(hostname:string,type:'A'|'AAAA')=>Promise<string[]>=Deno.resolveDns):Promise<string> {
 if(source.id==='frankfurter'&&source.endpoint===ECB_URL)return ECB_URL;
 if(source.id==='tat-metadata'&&source.endpoint===TAT_URL)return TAT_URL;
 // Registry and environment approvals are separate. DNS checks cannot pin fetch's later resolution;
 // this adapter stays disabled until the owner verifies trusted endpoint/egress operationally.
 if(source.id==='organizer-json'&&source.rightsConfirmed&&source.endpoint){
  const u=new URL(source.endpoint);const config=organizerConfig??{host:Deno.env.get('CONTENT_ORGANIZER_HOST')??'',egressVerified:Deno.env.get('CONTENT_ORGANIZER_EGRESS_VERIFIED')==='true'};
  if(config.egressVerified&&safeOrganizerHost(u.hostname)&&u.protocol==='https:'&&u.hostname===config.host&&!u.username&&!u.password&&!u.port){
   let timer:ReturnType<typeof setTimeout>|undefined;
   const resolved=await Promise.race([
    Promise.allSettled([resolver(u.hostname,'A'),resolver(u.hostname,'AAAA')]),
    new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>reject(new SyncError('upstream_timeout')),5000);})
   ]).finally(()=>{if(timer!==undefined)clearTimeout(timer);});
   const addresses=resolved.flatMap(result=>result.status==='fulfilled'?result.value:[]);
   if(addresses.length>0&&addresses.every(publicAddress))return u.href;
  }
 }
 throw new SyncError('invalid_source');
}
async function rpc(db:RpcDb,name:string,args:Record<string,unknown>):Promise<unknown> {
 try{const result=await db.rpc(name,args).abortSignal(AbortSignal.timeout(8000));if(result.error)throw new SyncError('database_unavailable');return result.data;}
 catch(e){if(e instanceof SyncError)throw e;throw new SyncError('database_unavailable');}
}
export async function runContentSync(db:RpcDb,fetcher:typeof fetch=fetch):Promise<{claimed:number;completed:number;failed:number}> {
 const claims=await rpc(db,'claim_content_sources',{p_limit:2}) as SourceClaim[];
 if(!Array.isArray(claims)||claims.length>2)throw new SyncError('database_unavailable');
 let completed=0,failed=0;
 for(const source of claims){
  try{
   const endpoint=await checkedEndpoint(source);
   // ECB is small and can correct same-day quotes, so a date alone never skips its fetch.
   const fetched=await boundedJson(endpoint,fetcher,null);
   let version:string,sourceUpdatedAt:string|null,rowsRead=0,rows:Record<string,unknown>[]=[],fx:Record<string,unknown>|null=null;
   if(source.id==='frankfurter'){const batch=ecbBatch(fetched.body);version=batch.version;sourceUpdatedAt=batch.sourceUpdatedAt;rowsRead=batch.rowsRead;fx=batch.fx;}
   else if(source.id==='tat-metadata'){const batch=tatMetadata(fetched.body);version=batch.version;sourceUpdatedAt=batch.sourceUpdatedAt;}
   else {const batch=organizerBatch(fetched.body,source);version=batch.version;sourceUpdatedAt=batch.sourceUpdatedAt;rowsRead=batch.rowsRead;rows=batch.rows;}
   await rpc(db,'finish_content_source',{p_id:source.id,p_lease:source.lease,p_version:version,p_source_updated:sourceUpdatedAt,p_rows:rows,p_fx:fx,p_rows_read:rowsRead,p_etag:fetched.etag,p_complete:source.id==='organizer-json'});completed++;
  }catch(e){failed++;const code=e instanceof SyncError?e.code:'invalid_source';await rpc(db,'fail_content_source',{p_id:source.id,p_lease:source.lease,p_code:code});}
 }
 return {claimed:claims.length,completed,failed};
}
export function secretMatches(actual:string,expected:string):boolean {
 if(!/^[a-f0-9]{64}$/.test(expected))return false;
 let mismatch=actual.length^expected.length;for(let i=0;i<expected.length;i++)mismatch|=(actual.charCodeAt(i)||0)^expected.charCodeAt(i);return mismatch===0;
}
export function contentSignatureMessage(stamp:string,nonce:string,target:string):string {
 return ['content-sync-v1',stamp,nonce,target].join('\n');
}
export async function signedContentAuthorization(headers:Headers,secret:string,target:string,now=Date.now()):Promise<{nonce:string;timestamp:number}|null> {
 const stamp=headers.get('X-Content-Timestamp')??'',nonce=headers.get('X-Content-Nonce')??'',signature=headers.get('X-Content-Signature')??'';
 if(!/^[a-f0-9]{64}$/.test(secret)||!/^https:\/\/[a-z0-9]{20}\.supabase\.co\/functions\/v1\/sync-content$/.test(target)||!/^\d{10}$/.test(stamp)||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(nonce)||!/^[a-f0-9]{64}$/.test(signature))return null;
 const timestamp=Number(stamp),seconds=Math.floor(now/1000);if(timestamp<seconds-60||timestamp>seconds+10)return null;
 try{
  const encoder=new TextEncoder(),key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const computed=[...new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(contentSignatureMessage(stamp,nonce,target))))].map(v=>v.toString(16).padStart(2,'0')).join('');
  return secretMatches(signature,computed)?{nonce,timestamp}:null;
 }catch{return null;}
}
