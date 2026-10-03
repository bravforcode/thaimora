import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {publicPages} from '../../scripts/lib/public-pages';

const rows=(count:number)=>Array.from({length:count},(_,i)=>({id:'synthetic-'+String(i).padStart(6,'0')}));
const cutoff='2026-10-03T14:00:00.000Z';
const query='events?published=eq.true&rights_status=eq.approved&demo=eq.false&ends_at=gt.'+encodeURIComponent(cutoff)+'&select=id,name,source_url,license';
beforeEach(()=>{
 vi.stubEnv('SUPABASE_URL','https://synthetic-db.invalid');
 vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','synthetic-private-test-key');
});
afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();});

function database(records:any[],requests:URL[],cap=1000,failOffset=-1){
 return vi.spyOn(globalThis,'fetch').mockImplementation(async(input)=>{
  const url=new URL(String(input));requests.push(url);
  const offset=Number(url.searchParams.get('offset')),limit=Number(url.searchParams.get('limit'));
  if(offset===failOffset)return new Response('synthetic private database error',{status:503});
  return Response.json(records.slice(offset,offset+Math.min(limit,cap)));
 });
}

describe('public snapshot content pagination',()=>{
 it('exports all1868 records with stable filters/projection/order and checks a final short-page sentinel',async()=>{
  const records=rows(1868),requests:URL[]=[];database(records,requests);
  await expect(publicPages(query)).resolves.toEqual(records);
  expect(requests.map(url=>[Number(url.searchParams.get('offset')),Number(url.searchParams.get('limit'))])).toEqual([[0,500],[500,500],[1000,500],[1500,500],[1868,1]]);
  for(const url of requests){
   expect(url.pathname).toBe('/rest/v1/events');expect(url.searchParams.get('order')).toBe('id');
   expect(url.searchParams.get('published')).toBe('eq.true');expect(url.searchParams.get('rights_status')).toBe('eq.approved');
   expect(url.searchParams.get('demo')).toBe('eq.false');expect(url.searchParams.get('ends_at')).toBe('gt.'+cutoff);
   expect(url.searchParams.get('select')).toBe('id,name,source_url,license');
  }
 });
 it('handles empty views and exact500-row boundaries',async()=>{
  const empty:URL[]=[];database([],empty);await expect(publicPages(query)).resolves.toEqual([]);expect(empty).toHaveLength(1);
  vi.restoreAllMocks();
  const requests:URL[]=[],records=rows(1000);database(records,requests);
  await expect(publicPages(query)).resolves.toEqual(records);expect(requests.map(url=>Number(url.searchParams.get('offset')))).toEqual([0,500,1000]);
 });
 it('rejects a lower server row cap instead of silently treating its first100 rows as complete',async()=>{
  const requests:URL[]=[];database(rows(234),requests,100);
  await expect(publicPages(query)).rejects.toThrow('Public content export incomplete');
  expect(requests.map(url=>[Number(url.searchParams.get('offset')),Number(url.searchParams.get('limit'))])).toEqual([[0,500],[100,1]]);
 });
 it('propagates a later-page error without returning partial content',async()=>{
  const requests:URL[]=[];database(rows(1868),requests,1000,500);
  await expect(publicPages(query)).rejects.toThrow('Database request failed: 503');expect(requests).toHaveLength(2);
 });
 it('propagates a final sentinel error instead of accepting unverified completeness',async()=>{
  const requests:URL[]=[];database(rows(234),requests,1000,234);
  await expect(publicPages(query)).rejects.toThrow('Database request failed: 503');expect(requests).toHaveLength(2);
 });
 it('accepts exactly10000 records with a final1-row probe and rejects larger catalogs',async()=>{
  const requests:URL[]=[];database(rows(10000),requests);
  await expect(publicPages(query)).resolves.toHaveLength(10000);expect(requests).toHaveLength(21);
  expect(requests.at(-1)?.searchParams.get('offset')).toBe('10000');expect(requests.at(-1)?.searchParams.get('limit')).toBe('1');
  vi.restoreAllMocks();
  const excess:URL[]=[];database(rows(10001),excess);
  await expect(publicPages(query)).rejects.toThrow('Public content export exceeds 10000 rows');expect(excess).toHaveLength(21);
 });
 it('rejects non-array database responses',async()=>{
  vi.spyOn(globalThis,'fetch').mockResolvedValue(Response.json(null));
  await expect(publicPages(query)).rejects.toThrow('Public content response must be a row array');
 });
});
