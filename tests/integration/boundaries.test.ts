import {describe,it,expect} from "vitest";
import {parsePropertyQuery,publicProperty,snapshotProperty,safeRedirect,minorAmount,searchInput,eventInterval,staysOverlap,parseCsv,importRows,safeCsvCell,launchErrors} from "../../supabase/functions/_shared/domain";
import {tatRows,normalizeTat} from "../../supabase/functions/_shared/sources";
describe("data boundaries",()=>{
 it("serializes only public fields and blocks static exact coordinates",()=>{
   const row={id:"p",public_location:{lat:7.9,lng:98.3,accuracy:"approximate",radiusMeters:300},privateLocation:{lat:7.912345,lng:98.312345},ownership_evidence:"private",images:[]};
   const output=publicProperty(row);expect(output).not.toHaveProperty("privateLocation");expect(JSON.stringify(output)).not.toContain("7.912345");expect(output).not.toHaveProperty("ownership_evidence");
   const snapshot=snapshotProperty({...row,public_location:{lat:7.912345,lng:98.312345,accuracy:"exact",radiusMeters:0}});
   expect(snapshot.location).toMatchObject({accuracy:"approximate",radiusMeters:300});expect(JSON.stringify(snapshot)).not.toContain("7.912345");
   expect(()=>snapshotProperty({...row,public_location:{lat:7.9,lng:98.3,accuracy:"approximate",radiusMeters:0}})).toThrow("private_coordinate_export");
 });
 it("rejects malformed filters/polygons and preserves cursor sort",()=>{
   expect(()=>parsePropertyQuery(new URL("https://test/?bbox=98,8,97,9"))).toThrow("invalid_bbox");
   expect(()=>parsePropertyQuery(new URL("https://test/?minPrice=500&maxPrice=100"))).toThrow("invalid_range");
   expect(()=>parsePropertyQuery(new URL("https://test/?sort=price;drop"))).toThrow("invalid_sort");
   expect(()=>parsePropertyQuery(new URL("https://test/?polygon="+encodeURIComponent(JSON.stringify({type:"Polygon",coordinates:[[[0,0],[1,0],[1,1],[2,2]]]}))))).toThrow("unclosed_polygon");
   expect(parsePropertyQuery(new URL("https://test/?transaction=rent&type=condo&minArea=25")).minArea).toBe(25);
 });
 it("requires real production launch criteria while allowing separate preview",()=>{
   const e={hostingProvider:'cloudflare',hostingPlan:'free',hostingPlanVerified:true,commercialHostingAllowed:true,hostingUsageVerified:true,hostingUsageObservedAt:new Date().toISOString(),hostingUsageEvidence:'synthetic-test-receipt',domainVerified:true,legalApproved:true,integrationVerified:true,uatApproved:true,rightsApproved:true,backupRestoreVerified:true,freeTierConfirmed:true,providerEntitlementsVerified:true,fixtureCount:0,approvedPropertyCount:500,approvedPoiCount:20,approvedHotelCount:1,publicFileCount:150,monthlyBuildCount:100,backupDailyBytes:1024};
   expect(launchErrors(e,"thaimora")).toEqual([]);expect(launchErrors({...e,approvedPropertyCount:499,fixtureCount:30},"thaimora")).toEqual(expect.arrayContaining(["500_properties","fixtures"]));
   expect(launchErrors({...e,approvedPoiCount:19,providerEntitlementsVerified:false},"taotide")).toEqual(expect.arrayContaining(["20_pois","provider_entitlements"]));
 });
});
describe("provider and source correctness",()=>{
 it("rejects hostile redirects, userinfo and affiliate mismatches",()=>{
   expect(()=>safeRedirect("https://booking.com.evil.test/h?aid=12","booking","12")).toThrow();
   expect(()=>safeRedirect("https://user:pass@www.booking.com/h?aid=12","booking","12")).toThrow();
   expect(()=>safeRedirect("https://www.booking.com/h?aid=13","booking","12")).toThrow("affiliate_id_mismatch");
   expect(safeRedirect("https://www.booking.com/h?aid=12","booking","12").hostname).toBe("www.booking.com");
 });
 it("uses exact decimal minor units",()=>{expect(minorAmount("107.14","THB")).toBe("10714");expect(minorAmount("123","JPY")).toBe("123");expect(minorAmount(null,"THB")).toBeNull();expect(()=>minorAmount("1.234","THB")).toThrow();});
 it("validates Bangkok stays and inclusive all day event ends",()=>{
   const event=eventInterval("2026-10-03","2026-10-03");expect(event.ends_at).toBe("2026-10-04T00:00:00+07:00");
   expect(staysOverlap("2026-10-03","2026-10-04",event.starts_at,event.ends_at)).toBe(true);
   expect(staysOverlap("2026-10-04","2026-10-05",event.starts_at,event.ends_at)).toBe(false);
   const raw={checkin:"2026-10-04",checkout:"2026-10-06",rooms:1,adults:2,childAges:[5],currency:"THB",countryOfResidence:"TH",locale:"en",platform:"desktop"};
   expect(searchInput(raw,new Date("2026-10-02T20:00:00Z")).childAges).toEqual([5]);expect(()=>searchInput({...raw,checkout:"2026-10-04"},new Date("2026-10-02T20:00:00Z"))).toThrow("invalid_stay");
 });
 it("accepts actual TAT uppercase SQL-root array and quarantines invalid coordinates",()=>{
   const row={NAME:"งาน",NAME_EN:"Event",STARTDATE:"2026-10-03",ENDDATE:"2026-10-04",LOCATION:"10.09,99.83",TATEVENTPLACEDETAIL:"place"};
   expect(tatRows({"SELECT * FROM ACTIVITY":[row]})).toEqual([row]);
   expect(normalizeTat(row,"https://datacatalog.tat.or.th/data/activity.json").rights_status).toBe("pending");
   expect(()=>normalizeTat({...row,LOCATION:"abc"},"https://example.test")).toThrow("tat_invalid_location");
 });
 it("handles CSV quoted rows, row errors and spreadsheet injection safely",()=>{
   expect(parseCsv('name,message\r\n"Sam","a,b"\r\n')).toEqual([["name","message"],["Sam","a,b"]]);
   const result=importRows([["slug","title_en"],["bad",""]]);expect(result.errors).toHaveLength(1);expect(result.errors[0].row_number).toBe(2);expect(result.rows).toEqual([]);
   expect(safeCsvCell("=HYPERLINK(1)")).toBe('"\'=HYPERLINK(1)"');
   expect(()=>parseCsv('name\n"broken')).toThrow("unterminated_csv");
 });
});
