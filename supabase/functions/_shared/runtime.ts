import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { ApiError, sha256 } from "./domain.ts";
import { clientIp } from "./http.ts";
export const env=(key:string)=>Deno.env.get(key)??"";
export function client(){
  if(!env("SUPABASE_URL")||!env("SUPABASE_SERVICE_ROLE_KEY"))throw new ApiError(503,"backend_not_configured");
  return createClient(env("SUPABASE_URL"),env("SUPABASE_SERVICE_ROLE_KEY"),{auth:{persistSession:false,autoRefreshToken:false}});
}
export function checkDb(result:any):any{if(result.error)throw new ApiError(503,"database_unavailable");return result.data;}
export async function body(req:Request):Promise<any>{
  const raw=await req.text();if(raw.length>5_000_000)throw new ApiError(413,"body_too_large");
  try{return JSON.parse(raw);}catch{throw new ApiError(422,"invalid_json");}
}
export function json(value:any,status=200):Response{return new Response(JSON.stringify(value),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});}
export async function admin(req:Request,db:any):Promise<string>{
  const bearer=req.headers.get("Authorization")??"";if(!bearer.startsWith("Bearer "))throw new ApiError(401,"unauthorized");
  const {data,error}=await db.auth.getUser(bearer.slice(7));if(error||!data.user)throw new ApiError(401,"unauthorized");
  const membership=checkDb(await db.from("admin_memberships").select("role").eq("user_id",data.user.id).maybeSingle());
  if(!membership)throw new ApiError(403,"admin_required");return data.user.id;
}
export async function rate(req:Request,db:any,bucket:string,limit=10):Promise<void>{
  if(!env("RATE_LIMIT_SALT"))throw new ApiError(503,"rate_protection_not_configured");
  const ip=clientIp(req);
  const key=await sha256(env("RATE_LIMIT_SALT")+":"+bucket+":"+ip);
  if(checkDb(await db.rpc("take_rate_limit",{p_key:key,p_limit:limit,p_seconds:60}))!==true)throw new ApiError(429,"rate_limited");
}
export { fetchJson } from "./http.ts";
export function serve(handler:(req:Request)=>Promise<Response>):void{
  Deno.serve(async req=>{
    const origin=req.headers.get("Origin"),allowed=env("ALLOWED_ORIGINS").split(",").filter(Boolean);
    if(origin&&!allowed.includes(origin))return json({error:{code:"origin_denied"}},403);
    let response:Response;
    if(req.method==="OPTIONS")response=new Response(null,{status:204});
    else try{response=await handler(req);}catch(e){const error=e instanceof ApiError?e:new ApiError(503,"dependency_unavailable");response=json({error:{code:error.code}},error.status);}
    if(origin)response.headers.set("Access-Control-Allow-Origin",origin);
    response.headers.set("Vary","Origin");
    response.headers.set("Access-Control-Allow-Headers","Authorization,Content-Type,Idempotency-Key,If-None-Match");
    response.headers.set("Access-Control-Expose-Headers","ETag,Cache-Control");
    response.headers.set("Access-Control-Allow-Methods","GET,POST,PUT,PATCH,DELETE,OPTIONS");
    return response;
  });
}
export async function content(db:any,scope:"full"|"events"="full"):Promise<any>{
  const pageSize=1000,maxRows=10000,cutoff=new Date().toISOString();
  async function readView(view:"public_pois"|"public_events"):Promise<any[]>{
    const rows:any[]=[];let expected=0;
    for(let offset=0;offset<=maxRows;offset+=pageSize){
      let query=db.from(view).select("*",offset===0?{count:"exact"}:undefined).order("id",{ascending:true}).range(offset,Math.min(offset+pageSize-1,maxRows));
      if(view==="public_events")query=query.gt("ends_at",cutoff);
      const result=await query,page=checkDb(result);
      if(!Array.isArray(page))throw new ApiError(503,"database_unavailable");
      if(offset===0){
        if(!Number.isInteger(result.count)||result.count<0)throw new ApiError(503,"content_incomplete");
        expected=result.count;if(expected>maxRows)throw new ApiError(503,"content_catalog_limit");
      }
      if(rows.length+page.length>maxRows)throw new ApiError(503,"content_catalog_limit");
      rows.push(...page);
      if(page.length<pageSize){
        if(rows.length!==expected)throw new ApiError(503,"content_incomplete");
        return rows;
      }
    }
    throw new ApiError(503,"content_catalog_limit");
  }
  if(scope==="events")return {events:await readView("public_events")};
  const [pois,events]=await Promise.all([readView("public_pois"),readView("public_events")]);
  return {pois,events};
}
export async function fx(db:any,url:URL):Promise<any>{
  if((url.searchParams.get("base")??"THB")!=="THB")throw new ApiError(422,"base_must_be_thb");
  const row=checkDb(await db.from("fx_rates").select("base,rates,as_of,source,fetched_at").eq("base","THB").maybeSingle());
  if(!row)throw new ApiError(503,"fx_unavailable");
  const quotes=(url.searchParams.get("quotes")??"").split(",").filter(Boolean);if(quotes.some(q=>!/^[A-Z]{3}$/.test(q)))throw new ApiError(422,"invalid_quotes");
  const rates=quotes.length?Object.fromEntries(quotes.filter(q=>row.rates[q]!=null).map(q=>[q,row.rates[q]])):row.rates;
  return {base:"THB",rates,date:row.as_of,source:row.source,stale:Date.now()-Date.parse(row.fetched_at)>172800000};
}
