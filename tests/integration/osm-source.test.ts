import {readFileSync} from "node:fs";
import {describe,it,expect} from "vitest";
import {licensedOsmRecords} from "../../supabase/functions/_shared/sources";
describe("actual licensed OSM source extract",()=>{
 const extract=JSON.parse(readFileSync("docs/imports/osm-phuket-pois.json","utf8"));
 it("validates the actual source records without asserting a field survey",()=>{
  const rows=licensedOsmRecords(extract,true);expect(rows.length).toBe(1868);expect(new Set(rows.map(r=>r.id)).size).toBe(1868);
  expect(rows.every(r=>r.source==="osm"&&!r.demo&&r.rights_status==="approved")).toBe(true);
  expect(rows.every(r=>r.source_url.startsWith("https://www.openstreetmap.org/"))).toBe(true);
 });
 it("requires license review, deduplicates ID and removes extra PII",()=>{
  expect(()=>licensedOsmRecords(extract,false)).toThrow("osm_license_review_required");
  const first=extract.records[0],rows=licensedOsmRecords({records:[{...first,email:"must-not-persist",phone:"private"},first]},true);
  expect(rows).toHaveLength(1);expect(rows[0]).not.toHaveProperty("email");expect(rows[0]).not.toHaveProperty("phone");
 });
});
