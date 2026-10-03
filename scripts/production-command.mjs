import { existsSync, readFileSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { hostingErrors } from '../supabase/functions/_shared/hosting.ts';

const root = resolve(import.meta.dirname, '..');
export const site = "thaimora";
const required = [
  'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SITE_URL', 'ALLOWED_ORIGINS', 'RATE_LIMIT_SALT',
  'GEOAPIFY_API_KEY',
];
const siteRequired = site === 'thaimora'
  ? ['NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY', 'TURNSTILE_HOSTNAMES',
     'RESEND_API_KEY', 'INQUIRY_EMAIL_TO', 'INQUIRY_EMAIL_FROM', 'EMAIL_WORKER_SECRET']
  : ['API_BASE_URL', 'BOOKING_API_KEY', 'BOOKING_CREDENTIAL_AFFILIATE_ID',
     'BOOKING_SEARCH_ENDPOINT', 'BOOKING_ENDPOINT_VERIFIED_AT',
     'AGODA_API_KEY', 'AGODA_CREDENTIAL_AFFILIATE_ID',
     'AGODA_SEARCH_ENDPOINT', 'AGODA_ENDPOINT_VERIFIED_AT'];

function https(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password &&
      !['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname) &&
      !url.hostname.endsWith('.test') && !url.hostname.endsWith('.invalid') &&
      !url.hostname.endsWith('.example') && !url.hostname.endsWith('.example.com');
  } catch { return false; }
}

export function configurationErrors(env, deployment = false) {
  const missing = [...required, ...siteRequired]
    .filter(key => !env[key]?.trim()).map(key => 'missing:' + key);
  if (deployment && env.HOSTING_PROVIDER !== (deployment === true ? 'vercel' : deployment))
    missing.push('hosting_provider_target_mismatch');
  const mode = site === 'thaimora' ? 'NEXT_PUBLIC_DATA_MODE' : 'NEXT_PUBLIC_APP_MODE';
  if (env[mode] !== 'live') missing.push(mode + '=live');
  for (const key of ['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_API_URL', 'NEXT_PUBLIC_SITE_URL']) {
    if (!https(env[key])) missing.push('https:' + key);
  }
  if (env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') !== env.SUPABASE_URL?.replace(/\/$/, ''))
    missing.push('admin_database_mismatch');
  try {
    const api = new URL(env.NEXT_PUBLIC_API_URL);
    const db = new URL(env.SUPABASE_URL);
    if (api.origin !== db.origin || api.pathname.replace(/\/$/, '') !== '/functions/v1/api')
      missing.push('supabase_api_base_mismatch');
    const origin = new URL(env.NEXT_PUBLIC_SITE_URL).origin;
    if (!(env.ALLOWED_ORIGINS ?? '').split(',').includes(origin))
      missing.push('site_origin_missing_from_cors');
    if (site === 'thaimora' && !(env.TURNSTILE_HOSTNAMES ?? '').split(',').includes(new URL(origin).hostname))
      missing.push('site_hostname_missing_from_turnstile');
  } catch { missing.push('invalid_site_or_api_origin'); }
  if (env.NEXT_PUBLIC_SUPABASE_ANON_KEY && env.NEXT_PUBLIC_SUPABASE_ANON_KEY === env.SUPABASE_SERVICE_ROLE_KEY)
    missing.push('public_key_is_service_key');
  try {
    const payload = JSON.parse(Buffer.from((env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').split('.')[1], 'base64url').toString());
    if (payload.role === 'service_role') missing.push('public_key_is_service_role');
    else if (payload.role !== 'anon') missing.push('public_key_is_not_anon');
  } catch {
    // Publishable keys are not JWTs. Secret/unknown key forms must not enter JS.
    if (env.NEXT_PUBLIC_SUPABASE_ANON_KEY && !env.NEXT_PUBLIC_SUPABASE_ANON_KEY.startsWith('sb_publishable_'))
      missing.push('public_key_is_not_publishable');
  }
  if (env.GEOAPIFY_RIGHTS_CONFIRMED !== 'true') missing.push('GEOAPIFY_RIGHTS_CONFIRMED=true');
  if (!env.NEXT_PUBLIC_MAP_STYLE_URL && !(site === 'thaimora' && env.NEXT_PUBLIC_ARCGIS_API_KEY))
    missing.push('production_map_configuration');
  if (env.NEXT_PUBLIC_MAP_STYLE_URL && !https(env.NEXT_PUBLIC_MAP_STYLE_URL))
    missing.push('https:NEXT_PUBLIC_MAP_STYLE_URL');
  if (site === 'thaimora' && /^(?:1x|2x|3x)0{18,}/.test(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''))
    missing.push('turnstile_test_key');
  if (site === 'taotide') {
    if (env.API_BASE_URL?.replace(/\/$/, '') !== env.NEXT_PUBLIC_API_URL?.replace(/\/$/, ''))
      missing.push('pages_api_base_mismatch');
    for (const provider of ['BOOKING', 'AGODA']) {
      if (env[provider + '_RESPONSE_SCHEMA_VERIFIED'] !== 'true')
        missing.push(provider + '_RESPONSE_SCHEMA_VERIFIED=true');
      if (!https(env[provider + '_SEARCH_ENDPOINT'])) missing.push('https:' + provider + '_SEARCH_ENDPOINT');
    }
  }
  if (deployment === 'vercel' || deployment === true) {
    for (const key of ['VERCEL_ORG_ID', 'VERCEL_PROJECT_ID'])
      if (!env[key]?.trim()) missing.push('missing:' + key);
  }
  if (deployment === 'cloudflare') {
    for (const key of ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_PROJECT_NAME', 'CLOUDFLARE_PRODUCTION_BRANCH'])
      if (!env[key]?.trim()) missing.push('missing:' + key);
    if (env.CLOUDFLARE_PROJECT_NAME && !/^[a-z0-9][a-z0-9-]*$/.test(env.CLOUDFLARE_PROJECT_NAME))
      missing.push('invalid:CLOUDFLARE_PROJECT_NAME');
    if (env.CLOUDFLARE_PRODUCTION_BRANCH?.startsWith('-'))
      missing.push('invalid:CLOUDFLARE_PRODUCTION_BRANCH');
  }
  return [...new Set(missing)];
}

function run(module, args = []) {
  const result = spawnSync(process.execPath, [resolve(root, module), ...args], {
    cwd: root, env: process.env, stdio: 'inherit',
  });
  if (result.error || result.status !== 0) throw new Error('command_failed:' + module);
}
export function main(command = process.argv[2]) {
  if (!['check', 'build', 'deploy', 'deploy:cloudflare'].includes(command)) throw new Error('Use check, build, deploy or deploy:cloudflare');
  // Standard Node loader; process/CI environment takes precedence. Never print values.
  const envFile = resolve(root, '.env.production.local');
  if (existsSync(envFile)) {
    try { loadEnvFile(envFile); } catch { throw new Error('Cannot load .env.production.local'); }
  }
  const target = command === 'deploy' ? 'vercel' : command === 'deploy:cloudflare' ? 'cloudflare' : false;
  const errors = configurationErrors(process.env, target);
  if (errors.length) throw new Error('Production configuration blocked: ' + errors.join(', '));
  let hostEvidence;
  try { hostEvidence=JSON.parse(readFileSync(resolve(root,'scripts/launch-evidence.json'),'utf8')); }
  catch { throw new Error('Missing reviewed hosting launch evidence'); }
  const hostErrors=hostingErrors(hostEvidence);
  if (hostEvidence?.hostingProvider !== process.env.HOSTING_PROVIDER) hostErrors.push('hosting_provider_mismatch');
  if (hostErrors.length) throw new Error('Hosting launch blocked: '+hostErrors.join(', '));
  run('scripts/production-gate.mjs', ['--production']);
  if (command === 'check') return;
  if (command !== 'deploy') {
    run('node_modules/next/dist/bin/next', ['build']);
    run('scripts/fix-export-locale.mjs');
    run('node_modules/tsx/dist/cli.mjs', ['scripts/launch-gate.ts', 'scripts/launch-evidence.json']);
  }
  if (command === 'deploy') {
    let linked, evidence;
    try {
      linked = JSON.parse(readFileSync(resolve(root, '.vercel/project.json'), 'utf8'));
      evidence = JSON.parse(readFileSync(resolve(root, 'scripts/launch-evidence.json'), 'utf8'));
    } catch { throw new Error('Vercel deployment requires existing reviewed project link and launch evidence'); }
    if (linked.orgId !== process.env.VERCEL_ORG_ID || linked.projectId !== process.env.VERCEL_PROJECT_ID)
      throw new Error('Vercel project link does not match the explicitly selected account/project');
    if (evidence.hostingProvider !== 'vercel' || evidence.hostingPlanVerified !== true || evidence.commercialHostingAllowed !== true)
      throw new Error('Vercel plan/terms for this commercial site are not verified');
    const cli = process.env.VERCEL_CLI_PATH ?? (process.env.APPDATA
      ? resolve(process.env.APPDATA, 'npm/node_modules/vercel/dist/index.js')
      : resolve(root, 'node_modules/vercel/dist/index.js'));
    if (!existsSync(cli)) throw new Error('Install or supply the authorized Vercel CLI path first');
    // Vercel build invokes the same build:production gate and packages the Node
    // function with static output. Ignored legal/snapshot files stay local.
    for (const args of [['build', '--prod'], ['deploy', '--prebuilt', '--prod', '--yes']]) {
      const authArgs = process.env.VERCEL_TOKEN ? ['--token', process.env.VERCEL_TOKEN] : [];
      const result = spawnSync(process.execPath, [cli, ...args, ...authArgs], {
        cwd: root, env: process.env, stdio: 'inherit',
      });
      if (result.error || result.status !== 0) throw new Error('Vercel command failed:' + args[0]);
    }
  }
  if (command === 'deploy:cloudflare') {
    // Existing client project only. Does not create accounts, upgrade plans or log in.
    run('node_modules/wrangler/bin/wrangler.js', [
      'pages', 'deploy', 'out', '--project-name', process.env.CLOUDFLARE_PROJECT_NAME,
      '--branch', process.env.CLOUDFLARE_PRODUCTION_BRANCH,
    ]);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
