export class ApiError extends Error { constructor(public status:number,public code:string,message=code){super(message);} }
export const text = (value:unknown,min=1,max=500):string => {
  if(typeof value!=="string" || value.trim().length<min || value.trim().length>max) throw new ApiError(422,"invalid_text");
  return value.trim();
};
export function integer(value:unknown,min:number,max:number):number {
  const n=Number(value); if(!Number.isInteger(n)||n<min||n>max) throw new ApiError(422,"invalid_integer"); return n;
}
export function coordinate(value:any):{lat:number,lng:number} {
  const valid=(n:unknown)=>(typeof n==='number'||(typeof n==='string'&&n.trim()!==''))&&Number.isFinite(Number(n));
  if(!value || !valid(value.lat) || !valid(value.lng) || Math.abs(Number(value.lat))>90 || Math.abs(Number(value.lng))>180) throw new ApiError(422,"invalid_coordinate");
  return {lat:Number(value.lat),lng:Number(value.lng)};
}
export function bangkokToday(now=new Date()):string { return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit"}).format(now); }
export function isoDate(value:unknown):string {
  const s=text(value,10,10); if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s) throw new ApiError(422,"invalid_date"); return s;
}
export function nextDate(value:string):string { const d=new Date(isoDate(value)); d.setUTCDate(d.getUTCDate()+1); return d.toISOString().slice(0,10); }
export function eventInterval(start:unknown,end:unknown):{starts_at:string,ends_at:string,all_day:boolean} {
  const a=isoDate(String(start).slice(0,10)),b=isoDate(String(end).slice(0,10));
  if(b<a) throw new ApiError(422,"invalid_event_dates");
  return {starts_at:a+"T00:00:00+07:00",ends_at:nextDate(b)+"T00:00:00+07:00",all_day:true};
}
export function staysOverlap(checkin:string,checkout:string,eventStart:string,eventEnd:string):boolean {
  return Date.parse(checkin+"T00:00:00+07:00")<Date.parse(eventEnd) && Date.parse(checkout+"T00:00:00+07:00")>Date.parse(eventStart);
}
export type SearchInput={checkin:string;checkout:string;rooms:number;adults:number;childAges:number[];currency:string;countryOfResidence:string;locale:"en"|"th";platform:"desktop"|"mobile"};
export function searchInput(raw:any,now=new Date()):SearchInput {
  const checkin=isoDate(raw?.checkin),checkout=isoDate(raw?.checkout);
  if(checkin<bangkokToday(now)||checkout<=checkin||(Date.parse(checkout)-Date.parse(checkin))/86400000>30) throw new ApiError(422,"invalid_stay");
  const rooms=integer(raw.rooms,1,8),adults=integer(raw.adults,1,30);
  if(adults<rooms) throw new ApiError(422,"adults_per_room_required");
  if(!Array.isArray(raw.childAges)||raw.childAges.length>12) throw new ApiError(422,"invalid_children");
  const childAges=raw.childAges.map((v:unknown)=>integer(v,0,17));
  if(!/^[A-Z]{3}$/.test(raw.currency)||!/^[A-Z]{2}$/.test(raw.countryOfResidence)||!["en","th"].includes(raw.locale)||!["desktop","mobile"].includes(raw.platform)) throw new ApiError(422,"invalid_search_context");
  return {checkin,checkout,rooms,adults,childAges,currency:raw.currency,countryOfResidence:raw.countryOfResidence,locale:raw.locale,platform:raw.platform};
}
export function minorAmount(value:unknown,currency:string):string|null {
  if(value==null) return null; const s=String(value); if(!/^\d+(\.\d+)?$/.test(s)) throw new ApiError(502,"invalid_provider_amount");
  const digits=["JPY","KRW","VND"].includes(currency)?0:["BHD","KWD","OMR"].includes(currency)?3:2;
  const [whole,frac=""]=s.split("."); if(frac.slice(digits).replace(/0/g,"")) throw new ApiError(502,"provider_amount_precision");
  return (BigInt(whole)*10n**BigInt(digits)+BigInt((frac+"0".repeat(digits)).slice(0,digits)||"0")).toString();
}
export function safeRedirect(raw:unknown,provider:"booking"|"agoda",affiliate:string,extraHosts:string[]=[]):URL {
  const url=new URL(text(raw,8,4096)); const hostname=url.hostname.toLowerCase();
  const official=provider==="booking"?["booking.com","www.booking.com"]:["agoda.com","www.agoda.com"];
  if(url.protocol!=="https:"||url.username||url.password||url.port||(!official.includes(hostname)&&!extraHosts.includes(hostname))) throw new ApiError(502,"unsafe_provider_redirect");
  const key=provider==="booking"?"aid":"cid"; if(url.searchParams.get(key)!==affiliate) throw new ApiError(502,"affiliate_id_mismatch");
  return url;
}
export function haversine(a:{lat:number,lng:number},b:{lat:number,lng:number}):number {
  const rad=(v:number)=>v*Math.PI/180,dlat=rad(b.lat-a.lat),dlng=rad(b.lng-a.lng);
  const h=Math.sin(dlat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dlng/2)**2;
  return 6371008.8*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
}
export function publicProperty(row:any):any {
  return {id:row.id,slug:row.slug,title:row.title,description:row.description,transaction:row.transaction,type:row.type,priceTHB:Number(row.price_thb),areaM2:Number(row.area_m2),landAreaM2:row.land_area_m2==null?null:Number(row.land_area_m2),beds:row.beds,baths:row.baths,floor:row.floor,builtYear:row.built_year,ownership:row.ownership,furnishing:row.furnishing,status:row.status,location:row.public_location,zone:row.zone,province:row.province,images:row.images??[],amenities:row.amenities??[],updatedAt:row.updated_at,expiresAt:row.expires_at,...(row.source_url?{sourceUrl:row.source_url}:{}),...(row.license?{license:row.license}:{}),...(row.fetched_at?{fetchedAt:row.fetched_at}:{}),...(row.source_updated_at?{sourceUpdatedAt:row.source_updated_at}:{})};
}
export function publicHotel(row:any):any {
  return {id:row.id,slug:row.slug,name:row.name,description:row.description,type:row.type,location:row.location,zoneId:row.zone_id,images:row.images??[],amenities:row.amenities??[],reviewScore:row.review_score==null?null:Number(row.review_score),reviewScale:Number(row.review_scale),stars:row.stars==null?null:Number(row.stars),beachfront:row.beachfront,pierDistanceKm:Number(row.pier_distance_km),providerIds:row.provider_ids??{},updatedAt:row.updated_at};
}
export function publicContent(row:any):any {
  return {id:row.id,name:row.name,description:row.description,category:row.category,location:row.location,zoneId:row.zone_id,image:row.image,sourceUrl:row.source_url,source:row.source,license:row.license,fetchedAt:row.fetched_at,sourceUpdatedAt:row.source_updated_at,website:row.website,demo:row.demo,startsAt:row.starts_at,endsAt:row.ends_at};
}
export function snapshotProperty(row:any):any {
  const p=publicProperty(row);
  if(p.location?.accuracy==="exact"){const safe=coordinate(p.location);p.location={lat:Math.round(safe.lat/0.002)*0.002,lng:Math.round(safe.lng/0.002)*0.002,accuracy:"approximate",radiusMeters:300};}
  if(p.location?.accuracy!=="approximate" || p.location?.radiusMeters<300) throw new ApiError(422,"private_coordinate_export");
  return p;
}
export function parsePropertyQuery(url:URL):any {
  const q=url.searchParams,sort=q.get("sort")??"newest";
  if(!["relevance","distance","newest","price_asc","price_desc","area_desc"].includes(sort)) throw new ApiError(422,"invalid_sort");
  const result:any={sort,limit:integer(q.get("limit")??30,1,50)};
  for(const [key,allowed] of Object.entries({transaction:["sale","rent"],type:["condo","house","villa","land","townhouse"],status:["available","sold","rented"],ownership:["freehold","leasehold","unknown"],furnishing:["furnished","partly_furnished","unfurnished"]})) {
    const val=q.get(key); if(val && !allowed.includes(val)) throw new ApiError(422,"invalid_"+key); result[key]=val;
  }
  for(const key of ["minPrice","maxPrice","minArea","maxArea","beds","baths"]) {
    const val=q.get(key); if(val!=null){const num=Number(val);if(!Number.isFinite(num)||num<0||num>1e12)throw new ApiError(422,"invalid_"+key);result[key]=num;}
  }
  if(result.minPrice>result.maxPrice||result.minArea>result.maxArea)throw new ApiError(422,"invalid_range");
  for(const key of ["zone","province"]) if(q.get(key)) result[key]=text(q.get(key),1,100);
  if(q.get("q"))result.q=text(q.get("q"),1,100);
  if(q.get("amenities"))result.amenities=q.get("amenities")!.split(",").map(v=>text(v,1,80)).slice(0,20);
  result.center=(q.get("center")??"98.33,7.94").split(",").map(Number);
  if(result.center.length!==2)throw new ApiError(422,"invalid_center");
  coordinate({lng:result.center[0],lat:result.center[1]});
  if(q.get("bbox")){result.bbox=q.get("bbox")!.split(",").map(Number);const [w,s,e,n]=result.bbox;if(result.bbox.length!==4||result.bbox.some((v:number)=>!Number.isFinite(v))||w>=e||s>=n||w<-180||e>180||s<-90||n>90)throw new ApiError(422,"invalid_bbox");}
  if(q.get("polygon")){
    try{result.polygon=JSON.parse(q.get("polygon")!);}catch{throw new ApiError(422,"invalid_polygon");}
    const p=result.polygon;
    if(p?.type!=="Polygon"||!Array.isArray(p.coordinates)||p.coordinates.length!==1||!Array.isArray(p.coordinates[0])||p.coordinates[0].length<4||p.coordinates[0].length>51)throw new ApiError(422,"invalid_polygon");
    for(const pair of p.coordinates[0]){if(!Array.isArray(pair)||pair.length!==2)throw new ApiError(422,"invalid_polygon");coordinate({lat:pair[1],lng:pair[0]});}
    if(JSON.stringify(p.coordinates[0][0])!==JSON.stringify(p.coordinates[0].at(-1)))throw new ApiError(422,"unclosed_polygon");
    validatePolygonRing(p.coordinates[0]);
  }
  if(q.get("cursor")){try{result.cursor=JSON.parse(decodeURIComponent(q.get("cursor")!));}catch{throw new ApiError(422,"invalid_cursor");}if(result.cursor.sort!==sort||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(result.cursor.id)||result.cursor.value==null)throw new ApiError(422,"invalid_cursor");}
  return result;
}
export function validatePolygonRing(ring:number[][]):void {
  const count=ring.length-1;
  if(count<3||count>50||new Set(ring.slice(0,-1).map(p=>JSON.stringify(p))).size!==count)throw new ApiError(422,"invalid_polygon");
  const cross=(a:number[],b:number[],c:number[])=> (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const on=(a:number[],b:number[],c:number[])=>Math.abs(cross(a,b,c))<1e-12&&c[0]>=Math.min(a[0],b[0])&&c[0]<=Math.max(a[0],b[0])&&c[1]>=Math.min(a[1],b[1])&&c[1]<=Math.max(a[1],b[1]);
  let area=0;
  for(let i=0;i<count;i++){
    const a=ring[i],b=ring[i+1];area+=a[0]*b[1]-b[0]*a[1];
    for(let j=i+1;j<count;j++){
      if(j===i+1||(i===0&&j===count-1))continue;
      const c=ring[j],d=ring[j+1],abC=cross(a,b,c),abD=cross(a,b,d),cdA=cross(c,d,a),cdB=cross(c,d,b);
      if((abC*abD<0&&cdA*cdB<0)||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b))throw new ApiError(422,"self_intersecting_polygon");
    }
  }
  if(Math.abs(area)<1e-12)throw new ApiError(422,"degenerate_polygon");
}
export function parseCsv(input:string):string[][] {
  if(input.length>5_000_000)throw new ApiError(413,"import_too_large");
  const rows:string[][]=[];let row:string[]=[],cell="",quoted=false;
  for(let i=0;i<input.length;i++){const c=input[i];if(c==='"'){if(quoted&&input[i+1]==='"'){cell+='"';i++;}else if(!quoted&&cell.length)throw new ApiError(422,"invalid_csv_quote");else quoted=!quoted;}
    else if(c===","&&!quoted){row.push(cell);cell="";}else if((c==="\n"||c==="\r")&&!quoted){if(c==="\r"&&input[i+1]==="\n")i++;row.push(cell);if(row.some(Boolean))rows.push(row);row=[];cell="";}else cell+=c;}
  if(quoted)throw new ApiError(422,"unterminated_csv");row.push(cell);if(row.some(Boolean))rows.push(row);return rows;
}
export function safeCsvCell(v:unknown):string { let s=String(v??"");if(/^[\s]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'; }
export function importRows(rows:string[][]):{rows:any[],errors:any[]} {
  const headers=rows[0]??[],valid:any[]=[],errors:any[]=[];
  if(new Set(headers).size!==headers.length)throw new ApiError(422,"duplicate_csv_headers");
  rows.slice(1).forEach((cells,index)=>{
    const r:any=Object.fromEntries(headers.map((h,i)=>[h,cells[i]??""]));const rowNumber=index+2;
    try{
      r.ownership_evidence ||= r.ownership_evidence_url;
      r.image_rights_evidence ||= r.image_rights_evidence_url;
      for(const k of ["slug","title_en","title_th","description_en","description_th","transaction","type","ownership","furnishing","zone","province","ownership_evidence","image_url","image_rights_evidence"])text(r[k],1,2000);
      if(!["sale","rent"].includes(r.transaction)||!["condo","house","villa","land","townhouse"].includes(r.type)||!["freehold","leasehold"].includes(r.ownership)||!["furnished","partly_furnished","unfurnished"].includes(r.furnishing))throw new ApiError(422,"invalid_enum");
      const loc=coordinate({lat:r.lat,lng:r.lng}),price=Number(r.price_thb),area=Number(r.area_m2);
      if(!(price>0)||!(area>0)||!Number.isFinite(price)||!Number.isFinite(area)||!r.image_url.startsWith("https://"))throw new ApiError(422,"invalid_numeric_or_image");
      if(r.exact_publication_consent==="true"&&!r.consent_evidence)throw new ApiError(422,"consent_evidence_required");
      const optionalNumber=(key:string,min:number,max:number)=>r[key]?integer(r[key],min,max):null;
      const land=r.land_area_m2?Number(r.land_area_m2):null;
      if(land!==null&&(!Number.isFinite(land)||land<0))throw new ApiError(422,"invalid_land_area");
      const status=r.status||"available";
      if(!["available","sold","rented"].includes(status))throw new ApiError(422,"invalid_status");
      const expiry=r.expires_at||null;
      if(expiry&&!Number.isFinite(Date.parse(expiry)))throw new ApiError(422,"invalid_expiry");
      const amenities=r.amenities?(r.amenities.startsWith('[')?JSON.parse(r.amenities):r.amenities.split(/[|;]/).map((v:string)=>v.trim()).filter(Boolean)):[];
      if(!Array.isArray(amenities)||amenities.length>50||amenities.some((v:unknown)=>typeof v!=="string"||!v.trim()||v.length>80))throw new ApiError(422,"invalid_amenities");
      valid.push({rowNumber,property:{slug:r.slug,title:{en:r.title_en,th:r.title_th},description:{en:r.description_en,th:r.description_th},transaction:r.transaction,type:r.type,price_thb:price,area_m2:area,...(r.land_area_m2?{land_area_m2:land}:{}),...(r.floor?{floor:optionalNumber("floor",-10,200)}:{}),...(r.built_year?{built_year:optionalNumber("built_year",1800,2200)}:{}),...(r.status?{status}:{}),...(expiry?{expires_at:expiry}:{}),...(r.amenities?{amenities}:{}),ownership:r.ownership,furnishing:r.furnishing,zone:r.zone,province:r.province,ownership_evidence:r.ownership_evidence,source_id:r.source_id||null,source_url:r.source_url||null,rights_status:"pending",published:false,demo:false,beds:integer(r.beds||0,0,100),baths:integer(r.baths||0,0,100)},privateLocation:{...loc,exact_publication_consent:r.exact_publication_consent==="true",consent_evidence:r.consent_evidence||null},image:{url:r.image_url,alt:{en:r.title_en,th:r.title_th},rights_status:"pending",source_url:r.image_source_url||null,credit:r.image_credit||null},rightsEvidence:r.image_rights_evidence});
    }catch(e){errors.push({row_number:rowNumber,message:e instanceof Error?e.message:"invalid_row"});}
  });return {rows:valid,errors};
}
export async function sha256(input:string):Promise<string>{return [...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(input)))].map(v=>v.toString(16).padStart(2,"0")).join("");}
export function launchErrors(e:any,site:"thaimora"|"taotide"):string[]{
  const issues:string[]=[];
  for(const key of ["domainVerified","legalApproved","integrationVerified","uatApproved","rightsApproved","backupRestoreVerified","freeTierConfirmed"])if(e[key]!==true)issues.push(key);
  if(e.fixtureCount!==0)issues.push("fixtures");
  if(!Number.isInteger(e.publicFileCount)||e.publicFileCount>20000)issues.push("cloudflare_file_limit");
  if(!Number.isInteger(e.monthlyBuildCount)||e.monthlyBuildCount>500)issues.push("cloudflare_build_limit");
  if(e.backupDailyBytes>30*1024*1024||!Number.isFinite(e.backupDailyBytes))issues.push("backup_budget");
  if(site==="thaimora"&&e.approvedPropertyCount<500)issues.push("500_properties");
  if(site==="taotide"){if(e.approvedPoiCount<20)issues.push("20_pois");if(e.providerEntitlementsVerified!==true)issues.push("provider_entitlements");if(e.approvedHotelCount<1)issues.push("hotel_catalog");}
  return issues;
}
