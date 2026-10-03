import {writeFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';

async function main(){
 const [base,output]=process.argv.slice(2);
 const baseline=process.argv.includes('--baseline');
 if(!base||!output)throw new Error('API base and evidence output path required');
 const url=new URL(base);
 if(url.protocol!=='https:'||!/^([a-z]{20})\.supabase\.co$/.test(url.hostname)||url.pathname!=='/functions/v1/api'||url.username||url.password||url.search||url.hash)throw new Error('Canonical public Supabase API required');
 const samples:any[]=[];
 async function probe(scope:'full'|'events',etag?:string){
  const start=performance.now(),response=await fetch(base+'/v1/content'+(scope==='events'?'?scope=events':''),{headers:etag?{'If-None-Match':etag}:{},signal:AbortSignal.timeout(20000)});
  const bytes=new Uint8Array(await response.arrayBuffer()),ms=Math.round((performance.now()-start)*10)/10;
  const tag=response.headers.get('etag');
  if(response.status!==(etag?304:200))throw new Error('Unexpected '+scope+' HTTP status '+response.status);
  const data=bytes.length?JSON.parse(new TextDecoder().decode(bytes)):null;
  if(data){
   if(!Array.isArray(data.events)||(!baseline&&(typeof data.meta?.revision!=='string'||!tag)))throw new Error('Public content contract missing');
   if(scope==='events'&&('pois' in data||'homeSettings' in data))throw new Error('Event poll unexpectedly contains full catalog');
   if(scope==='full'&&(!Array.isArray(data.pois)||new Set(data.pois.map((row:any)=>row.id)).size!==data.pois.length))throw new Error('Incomplete or duplicate public catalog');
  }else if(bytes.length||response.status!==304)throw new Error('Invalid conditional response');
  samples.push({scope,conditional:!!etag,status:response.status,ms,bodyBytes:bytes.length,contentEncoding:response.headers.get('content-encoding'),contentLength:response.headers.get('content-length'),cacheControl:response.headers.get('cache-control'),etag:tag,pois:data?.pois?.length??null,events:data?.events?.length??null});
  return tag!;
 }
 for(let i=0;i<5;i++)await probe('full');
 if(!baseline){const eventTag=await probe('events');for(let i=0;i<5;i++)await probe('events',eventTag);}
 const groups=['full','events','conditional-events'].map(group=>{
  const rows=samples.filter(row=>group==='conditional-events'?row.scope==='events'&&row.conditional:row.scope===group&&!row.conditional),times=rows.map(row=>row.ms).sort((a,b)=>a-b);
  return {group,samples:rows.length,p50Ms:times[Math.ceil(times.length*.5)-1],p95Ms:times[Math.ceil(times.length*.95)-1],bodyBytes:rows[0]?.bodyBytes};
 });
 const report={measuredAt:new Date().toISOString(),baseline,apiOrigin:url.origin,client:'Single sequential Node fetch process on this Windows machine; connection warmness not controlled; body bytes are decoded bytes, not measured network transfer; no user-device or production frontend measurement',samples,groups};
 await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({output,groups}));
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Probe failed');process.exitCode=1;});
