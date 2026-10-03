import {rest} from './lib/db';
import {vercelDeploymentReceipt} from './lib/rebuild-target';
async function main(){
  if(process.env.HOSTING_PROVIDER!=='vercel')throw new Error('Vercel receipt requires the selected Vercel target');
  // Invoked by vercel-ci only after the gated prebuilt deployment exits successfully.
  // The hash was captured before building; a later data edit cannot be certified here.
  const receipt=vercelDeploymentReceipt(process.argv[2]??'');
  await rest('sync_runs',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(receipt)});
  console.log(JSON.stringify({hostingProvider:'vercel',deploymentRecorded:true}));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
