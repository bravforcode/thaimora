const privateFields=new Set(['property_private_locations','privateLocation','ownership_evidence','ownershipEvidence','exact_publication_consent','consent_evidence','rights_evidence','service_role_key','resend_api_key']);
export function privateData(value:unknown):boolean{
 if(!value||typeof value!=='object')return false;
 return Object.entries(value).some(([key,item])=>privateFields.has(key)||privateData(item));
}
// Client schema identifiers are required to send authenticated admin requests.
// Inspect JSON data and actual secret values, rather than banning identifiers.
export function unsafeExport(filename:string,content:string,secrets:string[]=[]):boolean{
 if(secrets.some(secret=>secret.length>=8&&content.includes(secret)))return true;
 if(filename.endsWith('.json')){try{if(privateData(JSON.parse(content)))return true;}catch{return true;}}
 if(filename.endsWith('.html')){
  for(const match of content.matchAll(/<script\b[^>]*type=["']application\/(?:ld\+)?json["'][^>]*>([\s\S]*?)<\/script>/gi)){
   try{if(privateData(JSON.parse(match[1])))return true;}catch{return true;}
  }
 }
 // Public anonymous Supabase tokens are legitimate; service-role tokens are not.
 for(const match of content.matchAll(/eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)){
  try{if(JSON.parse(Buffer.from(match[1],'base64url').toString()).role==='service_role')return true;}catch{/* Non-JWT text is not a credential. */}
 }
 return false;
}
