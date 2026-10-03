import {mkdir,writeFile} from 'node:fs/promises';
async function main(){
 const site=process.argv[2];if(!['thaimora','taotide'].includes(site))throw new Error('Selected site required');
 const ref=site==='thaimora'?'hpjmttoxomdhxxsourih':'yhavmtvzdtvqpylruzfa',origin='https://'+site+'.vercel.app',base='https://'+ref+'.supabase.co/functions/v1/api/v1/content';
 const cases:{name:string;status:number;passed:boolean}[]=[];
 function proof(name:string,response:Response,ok:boolean,status:number){cases.push({name,status:response.status,passed:response.status===status&&ok});if(!cases.at(-1)?.passed)throw new Error('Public HTTP contract failed');}
 const request=(url:string,init:RequestInit={})=>fetch(url,{...init,signal:AbortSignal.timeout(20000),redirect:'error'});
 let failed=false;
 try{
  const preflight=await request(base,{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'GET','Access-Control-Request-Headers':'if-none-match,content-type,authorization'}});
  proof('conditional-request-preflight',preflight,preflight.headers.get('Access-Control-Allow-Origin')===origin&&(preflight.headers.get('Access-Control-Allow-Headers')??'').toLowerCase().includes('if-none-match'),204);
  const content=await request(base,{headers:{Origin:origin}}),tag=content.headers.get('ETag'),data=await content.json() as {pois?:{id:string}[];events?:unknown[];meta?:unknown};
  proof('full-public-count-and-unique-ids',content,Array.isArray(data.pois)&&data.pois.length===(site==='thaimora'?1868:234)&&new Set(data.pois.map(row=>row.id)).size===data.pois.length&&Array.isArray(data.events)&&!!data.meta&&!!tag,200);
  proof('validator-is-visible-to-browser',content,(content.headers.get('Access-Control-Expose-Headers')??'').toLowerCase().includes('etag')&&content.headers.get('Cache-Control')==='public, max-age=0, must-revalidate',200);
  const conditional=await request(base,{headers:{Origin:origin,'If-None-Match':tag!}}),bytes=(await conditional.arrayBuffer()).byteLength;
  proof('full-conditional-is-empty-and-cors-visible',conditional,bytes===0&&conditional.headers.get('Access-Control-Allow-Origin')===origin&&conditional.headers.get('ETag')===tag,304);
  const denied=await request(base,{headers:{Origin:'https://example.invalid'}});proof('unapproved-origin-denied',denied,denied.headers.get('Access-Control-Allow-Origin')===null,403);
 }catch{failed=true;}
 const report={site,projectRef:ref,testedAt:new Date().toISOString(),passed:!failed,cases,scope:'Actual public API CORS, validator and complete-count verification; assigned frontend origin is not evidence of frontend deployment'};
 await mkdir('docs/evidence',{recursive:true});await writeFile('docs/evidence/content-public-http.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(failed)process.exitCode=1;
}
void main().catch(()=>{console.error('Public content HTTP smoke failed');process.exitCode=1;});
