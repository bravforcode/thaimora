import {describe,it,expect} from 'vitest';
import {importRows} from '../../supabase/functions/_shared/domain';
import {licensedContent,reportRange} from '../../supabase/functions/_shared/admin-input';
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
});
