import {ApiError} from "../_shared/domain.ts";
import {serve,env,client,json,checkDb,fetchJson} from "../_shared/runtime.ts";
serve(async req=>{
  if(req.method!=="POST")throw new ApiError(405,"method_not_allowed");
  if(!env("EMAIL_WORKER_SECRET")||req.headers.get("Authorization")!=="Bearer "+env("EMAIL_WORKER_SECRET"))throw new ApiError(401,"unauthorized");
  if(!env("RESEND_API_KEY")||!env("INQUIRY_EMAIL_TO")||!env("INQUIRY_EMAIL_FROM"))throw new ApiError(503,"email_not_configured");
  const db=client(),batch=checkDb(await db.rpc("claim_email_batch",{p_limit:20}));let sent=0,failed=0;
  for(const task of batch){
    const inquiry=checkDb(await db.from("inquiries").select("id,name,email,country,message,property_id").eq("id",task.inquiry_id).single());
    try{
      await fetchJson("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+env("RESEND_API_KEY"),"Content-Type":"application/json","Idempotency-Key":"inquiry-"+inquiry.id},body:JSON.stringify({from:env("INQUIRY_EMAIL_FROM"),to:[env("INQUIRY_EMAIL_TO")],reply_to:inquiry.email,subject:"Property inquiry "+inquiry.property_id,text:"Name: "+inquiry.name+"\nEmail: "+inquiry.email+"\nCountry: "+inquiry.country+"\n\n"+inquiry.message})});
      checkDb(await db.from("email_outbox").update({status:"sent",sent_at:new Date().toISOString(),last_error:null}).eq("id",task.id));sent++;
    }catch{checkDb(await db.from("email_outbox").update({status:"failed",last_error:"email_provider_unavailable",next_attempt_at:new Date(Date.now()+Math.min(86400000,2**task.attempts*60000)).toISOString()}).eq("id",task.id));failed++;}
  }return json({sent,failed,pendingPreserved:failed});
});
