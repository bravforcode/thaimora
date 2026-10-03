import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {importPois} from '../../scripts/import-pois';

const fetchedAt='2026-10-03T14:00:00.000Z';
const record=(id:number)=>({
 id:'osm:node:'+id,name:{en:'Synthetic POI '+id,th:'Synthetic POI '+id},
 description:{en:'Synthetic test record',th:'Synthetic test record'},category:'place',
 location:{lat:7.9,lng:98.3},source:'osm',source_url:'https://www.openstreetmap.org/node/'+id,
 license:'ODbL 1.0',demo:false,admin_override:false,
});
type Request={table:string;method:string;body:any;prefer:string|null};

beforeEach(()=>{
 vi.stubEnv('SUPABASE_URL','https://synthetic-db.invalid');
 vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','synthetic-private-test-key');
 vi.spyOn(console,'log').mockImplementation(()=>{});
});
afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();});

function database(requests:Request[],failRawBatch=0){
 let rawBatches=0;
 return vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
  const url=new URL(String(input)),table=url.pathname.split('/').at(-1)!;
  const method=init?.method??'GET',body=init?.body?JSON.parse(String(init.body)):null;
  requests.push({table,method,body,prefer:new Headers(init?.headers).get('Prefer')});
  if(table==='sync_runs'&&method==='POST')return Response.json([{id:'synthetic-sync-run'}],{status:201});
  if(table==='sync_runs'&&method==='PATCH')return new Response(null,{status:204});
  if(table==='osm_pois'&&method==='POST'){
   rawBatches++;
   return new Response(null,{status:rawBatches===failRawBatch?403:201});
  }
  if(table==='pois'&&method==='GET'){
   const ids=(url.searchParams.get('id')??'').slice(4,-1).split(',');
   const existing=[{id:'osm:node:1',admin_override:true,rights_status:'approved',published:true},
    {id:'osm:node:2',admin_override:false,rights_status:'pending',published:false}];
   return Response.json(existing.filter(row=>ids.includes(row.id)));
  }
  if(table==='pois'&&method==='POST')return new Response(null,{status:201});
  throw new Error('Unexpected synthetic database request: '+table+' '+method);
 });
}

describe('licensed POI import writes',()=>{
 it('batches private source records100 at a time and preserves provenance and public overrides',async()=>{
  const requests:Request[]=[],records=Array.from({length:201},(_,i)=>record(i+1));
  Object.assign(records[0],{email:'must-not-persist',raw:{phone:'must-not-persist'}});
  database(requests);
  await importPois({records,fetchedAt},true);
  const sourceWrites=requests.filter(r=>r.table==='osm_pois'&&r.method==='POST');
  expect(sourceWrites.map(r=>r.body.length)).toEqual([100,100,1]);
  expect(sourceWrites.every(r=>r.prefer==='resolution=merge-duplicates,return=minimal')).toBe(true);
  const sources=sourceWrites.flatMap(r=>r.body);
  expect(new Set(sources.map(r=>r.id)).size).toBe(201);
  for(const row of sources){
   expect(row.source_url).toBe(row.payload.source_url);
   expect(row.license).toBe('ODbL 1.0');expect(row.payload.license).toBe(row.license);
   expect(row.fetched_at).toBe(fetchedAt);expect(row.payload.fetched_at).toBe(fetchedAt);
  }
  expect(sources[0].payload).not.toHaveProperty('email');expect(sources[0].payload).not.toHaveProperty('raw');
  const publicRows=requests.filter(r=>r.table==='pois'&&r.method==='POST').flatMap(r=>r.body);
  expect(publicRows).toHaveLength(200);expect(publicRows.some(r=>r.id==='osm:node:1')).toBe(false);
  expect(publicRows.find(r=>r.id==='osm:node:2')).toMatchObject({rights_status:'pending',published:false});
  expect(requests.at(-1)).toMatchObject({table:'sync_runs',method:'PATCH',body:{status:'completed',rows_read:201,rows_written:200}});
 });
 it('rejects an invalid tail record before creating a sync run or writing any source rows',async()=>{
  const fetch=database([]),records=Array.from({length:101},(_,i)=>record(i+1));
  records[100].name.en='x'.repeat(501);
  await expect(importPois({records,fetchedAt},true)).rejects.toThrow('invalid_text');
  expect(fetch).not.toHaveBeenCalled();
 });
 it('requires license review before any database request',async()=>{
  const fetch=database([]);
  await expect(importPois({records:[record(1)],fetchedAt})).rejects.toThrow('osm_license_review_required');
  expect(fetch).not.toHaveBeenCalled();
 });
 it('records a failed raw batch and does not start public upserts after the failure',async()=>{
  const requests:Request[]=[];database(requests,2);
  await expect(importPois({records:Array.from({length:201},(_,i)=>record(i+1)),fetchedAt},true)).rejects.toThrow('Database request failed: 403');
  expect(requests.filter(r=>r.table==='osm_pois')).toHaveLength(2);
  expect(requests.some(r=>r.table==='pois')).toBe(false);
  expect(requests.at(-1)).toMatchObject({table:'sync_runs',method:'PATCH',body:{status:'failed'}});
 });
});
