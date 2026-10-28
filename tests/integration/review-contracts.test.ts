import {describe,it,expect} from 'vitest';
import {importRows} from '../../supabase/functions/_shared/domain';
import {contentWriteFields,licensedContent,reportRange} from '../../supabase/functions/_shared/admin-input';
import {clientIp} from '../../supabase/functions/_shared/http';
describe('reviewed admin contracts',()=>{
 it('accepts downloaded-template evidence aliases and preserves optional fields while rejecting other rows',()=>{
  const row={slug:'real-home',title_en:'Home',title_th:'บ้าน',description_en:'Home description',description_th:'คำอธิบายบ้าน',transaction:'sale',type:'villa',ownership:'freehold',furnishing:'furnished',zone:'Bang Tao',province:'Phuket',ownership_evidence_url:'https://example.test/owner',image_url:'https://example.test/image',image_rights_evidence_url:'https://example.test/rights',lat:'7.9',lng:'98.3',price_thb:'1000000',area_m2:'100',land_area_m2:'150',floor:'2',built_year:'2024',status:'available',expires_at:'2027-01-01T00:00:00Z',amenities:'pool|parking'};
  const keys=Object.keys(row);const parsed=importRows([keys,Object.values(row),keys.map(k=>k==='image_url'?'http://insecure.test/image':row[k as keyof typeof row])]);
  expect(parsed.rows).toHaveLength(1);expect(parsed.errors[0].row_number).toBe(3);
  expect(parsed.rows[0].property).toMatchObject({floor:2,built_year:2024,land_area_m2:150,expires_at:'2027-01-01T00:00:00Z',amenities:['pool','parking'],published:false,demo:false,rights_status:'pending'});
  expect(parsed.rows[0].rightsEvidence).toBe(row.image_rights_evidence_url);
 });
 it('requires HTTPS licensed content and bounded inclusive report days',()=>{
  const source={demo:false,rights_status:'approved',source:'OSM',license:'ODbL',source_url:'https://www.openstreetmap.org/node/1'};
  expect(licensedContent(source)).toBe(true);expect(licensedContent({...source,source_url:'http://example.test'})).toBe(false);
  expect(reportRange(new URL('https://test?from=2026-10-01&to=2026-10-03'))).toEqual({from:'2026-10-01',to:'2026-10-03'});
  expect(()=>reportRange(new URL('https://test?from=2026-10-03&to=2026-10-01'))).toThrow('invalid_report_range');
 });
 it('admin content writes keep only editorial columns and never rename a row on update',()=>{
  expect(contentWriteFields('pois',{id:'poi-new',name:{en:'Cafe',th:'คาเฟ่'},rights_status:'approved',admin_override:false,fetched_at:'2000-01-01T00:00:00Z',source_quarantine:true})).toEqual({id:'poi-new',name:{en:'Cafe',th:'คาเฟ่'},rights_status:'approved'});
  expect(contentWriteFields('events',{id:'other',published:true,source_updated_at:'2000-01-01T00:00:00Z'},'event-1')).toEqual({published:true});
  expect(contentWriteFields('settings',{id:'home',value:{heading:{en:'Hi',th:'สวัสดี'}},updated_at:'2000-01-01T00:00:00Z'})).toEqual({id:'home',value:{heading:{en:'Hi',th:'สวัสดี'}}});
 });
 it('rate-limit client key comes from the last forwarded hop, never a client-supplied header',()=>{
  expect(clientIp(new Request('https://api.test',{headers:{'x-forwarded-for':'203.0.113.9, 198.51.100.7'}}))).toBe('198.51.100.7');
  expect(clientIp(new Request('https://api.test',{headers:{'x-forwarded-for':'198.51.100.7'}}))).toBe('198.51.100.7');
  expect(clientIp(new Request('https://api.test',{headers:{'cf-connecting-ip':'203.0.113.9'}}))).toBe('anonymous');
  expect(clientIp(new Request('https://api.test'))).toBe('anonymous');
 });
});
