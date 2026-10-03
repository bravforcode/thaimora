import {readFileSync} from "node:fs";
const live=process.env.NEXT_PUBLIC_DATA_MODE==="live";
if(!live&&!process.argv.includes("--production")){console.log("Explicit preview: production preflight skipped");process.exit(0);}
if(!live){console.error("Production requires NEXT_PUBLIC_DATA_MODE=live");process.exit(1);}
const file=process.argv.slice(2).find(arg=>!arg.startsWith("--"))??"scripts/launch-evidence.json";
let evidence;
try{evidence=JSON.parse(readFileSync(file,"utf8"));}catch{console.error("Production blocked: missing reviewed launch evidence");process.exit(1);}
const requirements=["domainVerified","legalApproved","integrationVerified","uatApproved","rightsApproved","backupRestoreVerified","freeTierConfirmed"];
if("thaimora"==="taotide")requirements.push("providerEntitlementsVerified");
const missing=requirements.filter(k=>evidence[k]!==true);
if(process.env.NEXT_PUBLIC_DATA_MODE!=="live")missing.push("NEXT_PUBLIC_DATA_MODE=live");
if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)missing.push("server database credentials");
if(!process.env.NEXT_PUBLIC_API_URL)missing.push("NEXT_PUBLIC_API_URL");
try{
 const legal=JSON.parse(readFileSync(process.env.THAIMORA_LEGAL_PATH,"utf8"));
 if(legal.approved!==true||["privacy","terms"].some(k=>["en","th"].some(l=>typeof legal[k]?.[l]!=="string"||legal[k][l].length<100)))missing.push("approved_bilingual_legal_copy");
}catch{missing.push("THAIMORA_LEGAL_PATH");}
try{
 const snapshot=JSON.parse(readFileSync(process.env.THAIMORA_SNAPSHOT_PATH,"utf8"));
 if(snapshot.mode!=="production"||!Array.isArray(snapshot.properties)||snapshot.properties.length<500)missing.push("production_property_snapshot");
 if(snapshot.properties.some(p=>p.demo||p.location?.accuracy!=="approximate"||p.location?.radiusMeters<300))missing.push("unsafe_snapshot_coordinates");
}catch{missing.push("THAIMORA_SNAPSHOT_PATH");}
if(missing.length){console.error("Production blocked: "+missing.join(", "));process.exit(1);}
console.log("Production preflight passed; post-build launch-gate.ts is still required.");
