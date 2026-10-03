import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {hostingErrors} from '../supabase/functions/_shared/hosting.ts';
const root=resolve(import.meta.dirname,'..');
function parsed(key){
  if(!process.env[key])throw new Error('Missing '+key);
  try{return JSON.parse(process.env[key]);}catch{throw new Error('Invalid JSON in '+key);}
}
try{
  const legal=parsed('PRODUCTION_LEGAL_JSON'),evidence=parsed('PRODUCTION_LAUNCH_EVIDENCE_JSON');
  const hostErrors=hostingErrors(evidence);
  if(hostErrors.length)throw new Error('Unverified hosting observations: '+hostErrors.join(', '));
  if(evidence.hostingProvider!=='vercel'||evidence.hostingPlanVerified!==true||evidence.commercialHostingAllowed!==true||evidence.freeTierConfirmed!==true)
    throw new Error('Vercel commercial hosting/free-cost entitlement is not verified');
  mkdirSync(resolve(root,'scripts/output'),{recursive:true});
  // Copy supplied reviewed evidence exactly. This command never grants approval.
  writeFileSync(resolve(root,'scripts/output/legal.json'),JSON.stringify(legal)+'\n',{encoding:'utf8',mode:0o600});
  writeFileSync(resolve(root,'scripts/launch-evidence.json'),JSON.stringify(evidence)+'\n',{encoding:'utf8',mode:0o600});
  console.log('Reviewed build files prepared in ignored private workspace');
}catch(error){console.error(error.message);process.exitCode=1;}
