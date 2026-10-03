import {deliverPublicContent} from '../../supabase/functions/_shared/public-content.ts';
import {json} from '../../supabase/functions/_shared/runtime.ts';
const meta=(revision='1')=>({revision,poisVersion:'1',eventsVersion:'1',homeVersion:'1',nextEventExpiryAt:null,sources:[{id:'organizer',kind:'events',status:'awaiting_source',enabled:false,checkedAt:null,lastSuccessAt:null,sourceUpdatedAt:null}]});
const request=(scope='',etag?:string)=>new Request('https://site.test/v1/content'+scope,{headers:etag?{'If-None-Match':etag}:{}});
function equal(a:unknown,b:unknown){if(JSON.stringify(a)!==JSON.stringify(b))throw new Error('Unexpected public content HTTP result');}
async function rejects(work:Promise<unknown>,code:string){try{await work;}catch(error){if(error instanceof Error&&'code' in error&&error.code===code)return;throw error;}throw new Error('Expected fail-closed response');}

Deno.test('unchanged public content returns bodyless304 without querying data or home',async()=>{
 let reads=0,homes=0;
 const reader={meta:async()=>meta(),content:async()=>{reads++;return {pois:[],events:[]};},home:async()=>{homes++;return {heading:'Known'};}};
 const first=await deliverPublicContent(request(),reader),etag=first.headers.get('ETag')!;
 const next=await deliverPublicContent(request('',etag),reader);
 equal(first.status,200);equal(next.status,304);equal(await next.text(),'');equal(reads,1);equal(homes,1);
 equal(next.headers.get('Cache-Control'),'public, max-age=0, must-revalidate');
});
Deno.test('event poll omits POIs and home and has a separate validator namespace',async()=>{
 const scopes:string[]=[];let homes=0;
 const reader={meta:async()=>meta(),content:async(scope:'full'|'events')=>{scopes.push(scope);return {pois:[{id:'synthetic-poi'}],events:[]};},home:async()=>{homes++;return {};}};
 const full=await deliverPublicContent(request(),reader),event=await deliverPublicContent(request('?scope=events',full.headers.get('ETag')!),reader);
 const data=await event.json();equal(event.status,200);equal('pois' in data,false);equal('homeSettings' in data,false);equal(scopes,['full','events']);equal(homes,1);
 equal(event.headers.get('ETag')===full.headers.get('ETag'),false);
});
Deno.test('conditional validators accept GET weak comparison and lists',async()=>{
 const reader={meta:async()=>meta(),content:async()=>({pois:[],events:[]})};
 const first=await deliverPublicContent(request(),reader),etag=first.headers.get('ETag')!;
 equal((await deliverPublicContent(request('', '"another", '+etag.replace(/^W\//,'')),reader)).status,304);
 equal((await deliverPublicContent(request('', '*'),reader)).status,304);
});
Deno.test('metadata exposes only public facts and keeps upstream timestamps separate',async()=>{
 const raw={...meta(),endpoint:'https://private.test',lease_token:'private-value',sources:[{...meta().sources[0],checkedAt:'2026-10-04T01:00:00Z',lastSuccessAt:'2026-10-03T01:00:00Z',sourceUpdatedAt:'2026-06-11T10:23:55Z',endpoint:'https://private.test',token:'private-value'}]};
 const response=await deliverPublicContent(request(),{meta:async()=>raw,content:async()=>({pois:[],events:[]})});
 const data=await response.json();equal(data.meta.sources[0].checkedAt,raw.sources[0].checkedAt);equal(data.meta.sources[0].sourceUpdatedAt,raw.sources[0].sourceUpdatedAt);
 equal(JSON.stringify(data).includes('private'),false);
});
Deno.test('update during read retries and attaches only the stable new revision',async()=>{
 let metadataReads=0,contentReads=0;
 const response=await deliverPublicContent(request(),{meta:async()=>meta(metadataReads++===0?'old':'new'),content:async()=>({pois:[{id:'synthetic-'+(++contentReads)}],events:[]})});
 const data=await response.json();equal(data.meta.revision,'new');equal(data.pois[0].id,'synthetic-2');equal(contentReads,2);
});
Deno.test('persistent changes and malformed metadata fail closed',async()=>{
 let revision=0;
 await rejects(deliverPublicContent(request(),{meta:async()=>meta(String(++revision)),content:async()=>({pois:[],events:[]})}),'content_changed_during_read');
 await rejects(deliverPublicContent(request(),{meta:async()=>({...meta(),eventsVersion:1}),content:async()=>({pois:[],events:[]})}),'content_metadata_unavailable');
 await rejects(deliverPublicContent(request(),{meta:async()=>({...meta(),nextEventExpiryAt:'invalid'}),content:async()=>({pois:[],events:[]})}),'content_metadata_unavailable');
});
Deno.test('unknown scope is rejected before any database read',async()=>{
 let reads=0;
 await rejects(deliverPublicContent(request('?scope=private'),{meta:async()=>{reads++;return meta();},content:async()=>({pois:[],events:[]})}),'invalid_content_scope');equal(reads,0);
});
Deno.test('default API JSON responses keep sensitive and provider routes no-store',()=>{equal(json({private:true}).headers.get('Cache-Control'),'no-store');});
Deno.test('atomic snapshot uses its own coherent revision without separate content/home reads',async()=>{
 let metaReads=0;
 const response=await deliverPublicContent(request(),{meta:async()=>{metaReads++;return meta('before');},content:async()=>{throw new Error('Separate content read forbidden');},home:async()=>{throw new Error('Separate home read forbidden');},atomicSnapshot:async scope=>{equal(scope,'full');return {pois:[{id:'synthetic-new'}],events:[],homeSettings:{heading:null},meta:meta('snapshot')};}});
 const data=await response.json();equal(data.meta.revision,'snapshot');equal(data.pois[0].id,'synthetic-new');equal(data.homeSettings,{heading:null});equal(metaReads,1);
});
Deno.test('malformed atomic snapshots fail closed and event scope omits full fields',async()=>{
 await rejects(deliverPublicContent(request(),{meta:async()=>meta(),content:async()=>({}),atomicSnapshot:async()=>({events:[],meta:meta()})}),'content_incomplete');
 const response=await deliverPublicContent(request('?scope=events'),{meta:async()=>meta(),content:async()=>({}),atomicSnapshot:async()=>({pois:[{id:'synthetic'}],events:[],homeSettings:{},meta:meta()})});
 const data=await response.json();equal('pois' in data,false);equal('homeSettings' in data,false);
});
