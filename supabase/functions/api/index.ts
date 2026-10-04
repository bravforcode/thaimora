import { ApiError,publicProperty,parsePropertyQuery,text,sha256,importRows,parseCsv,safeCsvCell,coordinate } from "../_shared/domain.ts";
import { serve,client,env,body,json,checkDb,admin,rate,fetchJson,fx } from "../_shared/runtime.ts";
import {auditMutation,reportRange} from "../_shared/admin-input.ts";
import {publicContentResponse} from "../_shared/public-content.ts";
import {apiParts} from "../_shared/api-path.ts";
import {brokerRoute,brokerAdminRoute,type BrokerDb} from "../_shared/broker-api.ts";
import {contactRoute} from "../_shared/contact-relay.ts";
const propertiesFields=["slug","title","description","transaction","type","price_thb","area_m2","land_area_m2","beds","baths","floor","built_year","ownership","furnishing","status","zone","province","amenities","published","demo","source_id","source_url","rights_status","ownership_evidence","expires_at"];
function safeFields(raw:any,allowed:string[]):any{return Object.fromEntries(Object.entries(raw).filter(([k])=>allowed.includes(k)));}
async function writeProperty(db:any,raw:any,id?:string,actor?:string):Promise<any>{
  const fields=safeFields(raw,propertiesFields);
  if(raw.privateLocation)coordinate(raw.privateLocation);
  if(raw.images!==undefined&&(!Array.isArray(raw.images)||raw.images.length>30))throw new ApiError(422,"invalid_gallery");
  const images=raw.images?.map((image:any)=>safeFields(image,["id","url","alt","credit","source_url","rights_status","rights_evidence"]));
  return checkDb(await db.rpc("admin_save_property",{p_id:id??null,p_fields:fields,p_private:raw.privateLocation?safeFields(raw.privateLocation,["lat","lng","exact_publication_consent","consent_evidence"]):null,p_images:images??null,p_actor:actor}));
}
serve(async req=>{
  const url=new URL(req.url),parts=apiParts(url),db=client();
  if(parts[0]==="broker"||parts[0]==="contact"){
    if(req.method!=="GET")await rate(req,db,"broker-"+parts[1],parts[1]==="checkout"?5:20);
    const response=await brokerRoute(req,parts,db as unknown as BrokerDb)??await contactRoute(req,parts,db as unknown as BrokerDb);
    if(response)return response;
  }
  if(parts[0]==="admin"){
    const userId=await admin(req,db),kind=parts[1],id=parts[2];
    const brokerResponse=await brokerAdminRoute(req,parts,db as unknown as BrokerDb,userId);if(brokerResponse)return brokerResponse;
    if(["pois","events"].includes(kind)&&id&&parts[3]==="automation"&&req.method==="POST"){
      if((await body(req)).enabled!==true)throw new ApiError(422,"explicit_automation_release_required");
      return json({item:checkDb(await db.rpc("admin_release_content_override",{p_table:kind,p_id:id,p_actor:userId}))});
    }
    if(kind==="inquiries"&&id==="export"&&req.method==="GET"){
      const rows=checkDb(await db.from("inquiries").select("id,property_id,name,email,country,message,created_at,status").order("created_at").limit(1000));
      const keys=["id","property_id","name","email","country","message","created_at","status"];
      return new Response([keys.map(safeCsvCell).join(","),...rows.map((r:any)=>keys.map(k=>safeCsvCell(r[k])).join(","))].join("\r\n"),{headers:{"Content-Type":"text/csv","Content-Disposition":"attachment; filename=inquiries.csv","Cache-Control":"no-store"}});
    }
    if(kind==="imports"&&req.method==="POST"){
      const raw=await body(req);let rows:string[][];
      // The administrator UI parses XLSX with read-excel-file and submits the
      // same canonical CSV contract. The server validates every normalized row.
      if(raw.xlsxBase64)throw new ApiError(422,"normalized_csv_required");
      rows=parseCsv(text(raw.csv,1,5_000_000));
      const duplicatePolicy=raw.duplicatePolicy??"skip";
      if(!["skip","update","error"].includes(duplicatePolicy))throw new ApiError(422,"invalid_duplicate_policy");
      const parsed=importRows(rows),job=checkDb(await db.from("import_jobs").insert({created_by:userId,source_name:raw.sourceName??"admin-import",status:"running",rows_read:rows.length-1}).select().single());
      let written=0,skipped=0;const errors=[...parsed.errors];
      for(const row of parsed.rows){try{
        const bySlug=checkDb(await db.from("properties").select("id").eq("slug",row.property.slug).maybeSingle());
        const bySource=row.property.source_id?checkDb(await db.from("properties").select("id").eq("source_id",row.property.source_id).maybeSingle()):null;
        if(bySlug&&bySource&&bySlug.id!==bySource.id)throw new ApiError(422,"conflicting_source_id");
        const existing=bySlug??bySource;
        if(existing&&duplicatePolicy==="skip"){skipped++;continue;}
        if(existing&&duplicatePolicy==="error")throw new ApiError(422,"duplicate_property");
        await writeProperty(db,{...row.property,privateLocation:row.privateLocation,images:[{...row.image,rights_evidence:row.rightsEvidence}]},existing?.id,userId);written++;
      }catch(e){errors.push({row_number:row.rowNumber,message:e instanceof ApiError?e.code:"Database rejected row; remains unpublished"});}}
      if(errors.length)checkDb(await db.from("import_errors").insert(errors.map(e=>({...e,job_id:job.id}))));
      checkDb(await db.from("import_jobs").update({status:errors.length?"completed_with_errors":"completed",rows_written:written}).eq("id",job.id));
      return json({job:{...job,rows_written:written},skipped,errors},201);
    }
    const tables:Record<string,string>={properties:"properties",inquiries:"inquiries",imports:"import_jobs",stats:"daily_property_stats",pois:"pois",events:"events",zones:"zones",settings:"site_settings"};
    if(!tables[kind])throw new ApiError(404,"not_found");
    if(req.method==="GET"){
      if(kind==="stats"){
        const range=reportRange(url);
        return json({items:checkDb(await db.rpc("property_stats_range",{p_from:range.from,p_to:range.to}))});
      }
      let query=db.from(tables[kind]).select(kind==="properties"?"*,property_private_locations(*),property_images(*)":"*").limit(1000);
      if(["pois","events"].includes(kind)&&url.searchParams.get("protected")==="true")query=query.eq("admin_override",true);
      if(id)query=query.eq("id",id);const rows=checkDb(await query);
      if(kind==="properties")return json({items:rows.map((r:any)=>({...publicProperty({...r,images:r.property_images?.map((i:any)=>({url:i.url,alt:i.alt,credit:i.credit,sourceUrl:i.source_url}))}),publication:{published:r.published,demo:r.demo,rightsStatus:r.rights_status,ownershipEvidence:r.ownership_evidence,sourceUrl:r.source_url,sourceId:r.source_id},privateLocation:r.property_private_locations?.[0]??r.property_private_locations,gallery:r.property_images}))});
      return json({items:rows});
    }
    if(kind==="properties"&&["POST","PATCH"].includes(req.method))return json({item:await writeProperty(db,await body(req),id,userId)},req.method==="POST"?201:200);
    if(kind==="properties"&&req.method==="DELETE"&&id){checkDb(await db.from("properties").delete().eq("id",id));await auditMutation(db,userId,"properties",id,"DELETE",[]);return json({deleted:true});}
    if(kind==="inquiries"&&req.method==="PATCH"&&id){const raw=await body(req);if(!["new","contacted","closed"].includes(raw.status))throw new ApiError(422,"invalid_status");return json({item:checkDb(await db.from("inquiries").update({status:raw.status}).eq("id",id).select().single())});}
    if(["pois","events","zones","settings"].includes(kind)&&["POST","PATCH","DELETE"].includes(req.method)){
      if(req.method==="DELETE"){checkDb(await db.from(tables[kind]).delete().eq("id",id));await auditMutation(db,userId,tables[kind],id,"DELETE",[]);return json({deleted:true});}
      const raw=await body(req);delete raw.source_quarantine;
      if(["pois","events"].includes(kind))raw.admin_override=true;
      const item=checkDb(id?await db.from(tables[kind]).update(raw).eq("id",id).select().single():await db.from(tables[kind]).insert(raw).select().single());
      await auditMutation(db,userId,tables[kind],String(item.id),id?"UPDATE":"INSERT",Object.keys(raw));return json({item});
    }
    throw new ApiError(405,"method_not_allowed");
  }
  if(req.method==="GET"&&parts[0]==="properties"){
    if(!parts[1]){
      const filters=parsePropertyQuery(url),limit=filters.limit;
      const rows=checkDb(await db.rpc("search_properties_v2",{p_filters:{...filters,limit:limit+1}})),page=rows.slice(0,limit),last=page.at(-1);
      return json({items:page.map((r:any)=>publicProperty(r.row_data)),nextCursor:rows.length>limit&&last?encodeURIComponent(JSON.stringify({sort:filters.sort,id:last.row_data.id,value:last.sort_value})):null});
    }
    const key=text(parts[1],1,100);if(!/^[a-zA-Z0-9_-]+$/.test(key))throw new ApiError(422,"invalid_property_id");
    const property=checkDb(await (/^[0-9a-f-]{36}$/.test(key)?db.from("public_properties").select("*").eq("id",key):db.from("public_properties").select("*").eq("slug",key)).maybeSingle());
    if(!property)throw new ApiError(404,"property_not_found");
    if(parts[2]==="nearby"){const loc=property.public_location;return json({items:checkDb(await db.rpc("nearby_content",{p_lat:loc.lat,p_lng:loc.lng,p_radius:5000}))});}
    return json(publicProperty(property));
  }
  if(req.method==="GET"&&parts[0]==="places"&&parts[1]==="autocomplete"){
    const q=text(url.searchParams.get("q"),2,100),locale=url.searchParams.get("locale")??"en";
    if(!["en","th"].includes(locale))throw new ApiError(422,"invalid_locale");
    if(!env("GEOAPIFY_API_KEY"))throw new ApiError(503,"autocomplete_not_configured");
    const data=await fetchJson("https://api.geoapify.com/v1/geocode/autocomplete?text="+encodeURIComponent(q)+"&lang="+locale+"&filter=countrycode:th&limit=8&apiKey="+env("GEOAPIFY_API_KEY"));
    return json({items:data.features.map((x:any)=>({id:x.properties.place_id,name:x.properties.formatted,location:{lat:x.properties.lat,lng:x.properties.lon}})),attribution:"Powered by Geoapify | © OpenStreetMap contributors"});
  }
  if(req.method==="GET"&&parts[0]==="content")return publicContentResponse(req,db);
  if(req.method==="GET"&&parts[0]==="fx")return json(await fx(db,url));
  if(req.method==="POST"&&parts[0]==="analytics"&&parts[1]==="events"){
    const raw=await body(req);
    if(raw.consented!==true||!["view","contact_click"].includes(raw.kind))throw new ApiError(422,"analytics_consent_required");
    const propertyId=text(raw.propertyId,36,36);
    if(!/^[0-9a-f-]{36}$/.test(propertyId))throw new ApiError(422,"invalid_property_id");
    await rate(req,db,"analytics",30);
    checkDb(await db.rpc("record_property_event",{p_property:propertyId,p_kind:raw.kind,p_consented:true}));
    return json({recorded:true},202);
  }
  if(req.method==="POST"&&parts[0]==="inquiries"){
    const raw=await body(req);if(raw.website||raw.honeypot)throw new ApiError(422,"spam_rejected");
    if(raw.consent!==true||raw.consentToShare!==true)throw new ApiError(422,"inquiry_contact_consent_required");
    const name=text(raw.name,2,100),email=text(raw.email,3,254),country=text(raw.country,2,80),message=text(raw.message,10,4000),propertyId=text(raw.propertyId,36,36),key=text(req.headers.get("Idempotency-Key"),8,128);
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!/^[0-9a-f-]{36}$/.test(propertyId))throw new ApiError(422,"invalid_inquiry");
    if(!env("TURNSTILE_SECRET_KEY"))throw new ApiError(503,"turnstile_not_configured");
    await rate(req,db,"inquiry",5);
    const token=text(raw.turnstileToken,1,2048),form=new URLSearchParams({secret:env("TURNSTILE_SECRET_KEY"),response:token});
    const check=await fetchJson("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",body:form});
    if(!check.success||check.action!=="inquiry"||!env("TURNSTILE_HOSTNAMES").split(",").includes(check.hostname))throw new ApiError(422,"turnstile_failed");
    const payload=await sha256(JSON.stringify({name,email,country,message,propertyId,consentToShare:true})),result=await db.rpc("submit_contact_inquiry",{p_property:propertyId,p_name:name,p_email:email,p_country:country,p_message:message,p_key:await sha256(key),p_payload:payload,p_share:true});
    if(result.error){if(result.error.message.includes("Idempotency conflict"))throw new ApiError(409,"idempotency_conflict");if(result.error.message.includes("Property unavailable"))throw new ApiError(422,"property_unavailable");throw new ApiError(503,"inquiry_not_saved");}
    if(env("EMAIL_WORKER_SECRET"))await fetch(env("SUPABASE_URL")+"/functions/v1/deliver-email",{method:"POST",headers:{Authorization:"Bearer "+env("EMAIL_WORKER_SECRET")},signal:AbortSignal.timeout(2000)}).catch(()=>undefined);
    if(env("CONTACT_DELIVERY_ENABLED")==="true"&&env("CONTACT_WORKER_SECRET"))await fetch(env("SUPABASE_URL")+"/functions/v1/deliver-contact",{method:"POST",headers:{Authorization:"Bearer "+env("CONTACT_WORKER_SECRET")},signal:AbortSignal.timeout(2000)}).catch(()=>undefined);
    return json({id:result.data.id,duplicate:result.data.duplicate,emailStatus:result.data.emailStatus,contactStatus:result.data.contactStatus},result.data.duplicate?200:202);
  }
  throw new ApiError(404,"not_found");
});
