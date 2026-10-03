import {existsSync,mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'..');
function run(file,args=[]){
  const result=spawnSync(process.execPath,[file,...args],{cwd:root,env:process.env,stdio:'inherit'});
  if(result.error||result.status!==0)throw new Error('Vercel CI step failed');
}
try{
  for(const key of ['VERCEL_ORG_ID','VERCEL_PROJECT_ID','VERCEL_TOKEN'])if(!process.env[key])throw new Error('Missing '+key);
  const cli=process.env.VERCEL_CLI_PATH;
  if(!cli||!existsSync(cli))throw new Error('Missing installed VERCEL_CLI_PATH');
  run(resolve(root,'scripts/prepare-production-build.mjs'));
  const proof=JSON.parse(readFileSync(resolve(root,'scripts/launch-evidence.json'),'utf8'));
  if(proof.hostingProvider!=='vercel'||proof.hostingPlanVerified!==true||proof.commercialHostingAllowed!==true)throw new Error('Unverified Vercel hosting plan');
  mkdirSync(resolve(root,'.vercel'),{recursive:true});
  writeFileSync(resolve(root,'.vercel/project.json'),JSON.stringify({orgId:process.env.VERCEL_ORG_ID,projectId:process.env.VERCEL_PROJECT_ID})+'\n');
  run(cli,['pull','--yes','--environment=production','--token',process.env.VERCEL_TOKEN]);
  run(resolve(root,'node_modules/tsx/dist/cli.mjs'),['scripts/export-public-content.ts','scripts/output/public-content.json']);
  const snapshot=JSON.parse(readFileSync(resolve(root,'scripts/output/public-content.json'),'utf8'));delete snapshot.generatedAt;
  const deployedHash=createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
  run(resolve(root,'scripts/production-command.mjs'),['deploy']);
  run(resolve(root,'node_modules/tsx/dist/cli.mjs'),['scripts/record-vercel-deployment.ts',deployedHash]);
}catch(error){console.error(error.message);process.exitCode=1;}
