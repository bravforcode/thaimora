import {content} from '../../supabase/functions/_shared/runtime.ts';

function equal(actual:unknown,expected:unknown):void{
 if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error('Unexpected content pagination result');
}
type Page={view:string;columns:string;count?:string;order?:string;ascending?:boolean;start:number;end:number;filter?:{column:string;cutoff:string}};
const rows=(length:number)=>Array.from({length},(_,i)=>({id:'synthetic-'+String(i).padStart(6,'0')}));
type Row=Record<string,unknown>;
type DatabasePage={data:Row[]|null;error:unknown;count:number|null};
function database(pois:Row[],events:Row[]=[],respond?:(page:Page,records:Row[])=>DatabasePage){
 const requests:Page[]=[];
 return {requests,from(view:string){
  const page:Page={view,columns:'',start:0,end:0},records=view==='public_pois'?pois:events;
  const query={
   select(columns:string,options?:{count?:string}){page.columns=columns;page.count=options?.count;return query;},
   order(column:string,options:{ascending:boolean}){page.order=column;page.ascending=options.ascending;return query;},
   range(start:number,end:number){page.start=start;page.end=end;return query;},
   gt(column:string,cutoff:string){page.filter={column,cutoff};return query;},
   then(resolve:(page:DatabasePage)=>unknown,reject?:(reason:unknown)=>unknown){
    requests.push({...page});
    const result=respond?respond(page,records):{data:records.slice(page.start,page.end+1),error:null,count:page.count==='exact'?records.length:null};
    return Promise.resolve(result).then(resolve,reject);
   },
  };return query;
 }};
}
async function rejects(work:Promise<unknown>,code:string):Promise<void>{
 try{await work;}catch(error){
  if(error instanceof Error&&'code' in error&&'status' in error&&error.code===code&&error.status===503)return;
  throw new Error('Unexpected pagination failure');
 }
 throw new Error('Expected content pagination to fail closed');
}

Deno.test('content returns all1868 POIs and multiple future-event pages in deterministic order',async()=>{
 const db=database(rows(1868),rows(1005)),result=await content(db);
 equal(result.pois,rows(1868));equal(result.events,rows(1005));
 equal(db.requests.filter(page=>page.view==='public_pois').map(page=>[page.start,page.end]),[[0,999],[1000,1999]]);
 equal(db.requests.filter(page=>page.view==='public_events').map(page=>[page.start,page.end]),[[0,999],[1000,1999]]);
 equal(db.requests.every(page=>page.columns==='*'&&page.order==='id'&&page.ascending===true),true);
 equal(db.requests.filter(page=>page.start===0).every(page=>page.count==='exact'),true);
 const eventPages=db.requests.filter(page=>page.view==='public_events');
 equal(eventPages.every(page=>page.filter?.column==='ends_at'),true);
 equal(new Set(eventPages.map(page=>page.filter?.cutoff)).size,1);
 equal(db.requests.filter(page=>page.view==='public_pois').every(page=>!page.filter),true);
});
Deno.test('content handles empty views and exact1000-row boundaries',async()=>{
 const empty=database([]);equal(await content(empty),{pois:[],events:[]});equal(empty.requests.length,2);
 const db=database(rows(1000),rows(2000)),result=await content(db);
 equal(result.pois.length,1000);equal(result.events.length,2000);
 equal(db.requests.filter(page=>page.view==='public_pois').length,2);
 equal(db.requests.filter(page=>page.view==='public_events').length,3);
});
Deno.test('event scope never queries the POI catalog',async()=>{
 const db=database(rows(1868),rows(2)),result=await content(db,'events');
 equal(result,{events:rows(2)});equal(db.requests.length,1);equal(db.requests[0].view,'public_events');
});
Deno.test('content rejects a later database-page error instead of returning partial content',async()=>{
 const db=database(rows(1868),[],(page,records)=>page.view==='public_pois'&&page.start===1000?
  {data:null,error:{message:'synthetic database failure'},count:null}:
  {data:records.slice(page.start,page.end+1),error:null,count:page.count==='exact'?records.length:null});
 await rejects(content(db),'database_unavailable');
});
Deno.test('content detects a lower server row cap and missing count metadata',async()=>{
 const capped=database(rows(1868),[],(page,records)=>({data:records.slice(page.start,Math.min(page.end+1,page.start+500)),error:null,count:page.count==='exact'?records.length:null}));
 await rejects(content(capped),'content_incomplete');
 const uncounted=database(rows(3),[],(page,records)=>({data:records.slice(page.start,page.end+1),error:null,count:null}));
 await rejects(content(uncounted),'content_incomplete');
});
Deno.test('content rejects catalogs above10000 rows without silently truncating them',async()=>{
 const db=database(rows(10001));await rejects(content(db),'content_catalog_limit');
 equal(db.requests.filter(page=>page.view==='public_pois').length,1);
});
Deno.test('content accepts exactly10000 rows with at most11 bounded requests per view',async()=>{
 const db=database(rows(10000)),result=await content(db);equal(result.pois.length,10000);
 const pages=db.requests.filter(page=>page.view==='public_pois');equal(pages.length,11);
 equal(pages.at(-1)?.start,10000);equal(pages.at(-1)?.end,10000);
 equal(pages.every(page=>page.end-page.start+1<=1000),true);
});
