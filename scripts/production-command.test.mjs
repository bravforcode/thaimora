import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configurationErrors, site } from './production-command.mjs';
const base = {
  SUPABASE_URL:'https://project.supabase.co', SUPABASE_SERVICE_ROLE_KEY:'private-service-key',
  NEXT_PUBLIC_API_URL:'https://project.supabase.co/functions/v1/api',
  NEXT_PUBLIC_SUPABASE_URL:'https://project.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY:'sb_publishable_public',
  NEXT_PUBLIC_SITE_URL:'https://' + site + '.com',
  ALLOWED_ORIGINS:'https://' + site + '.com', RATE_LIMIT_SALT:'private-salt',
  GEOAPIFY_API_KEY:'private-geo-key', GEOAPIFY_RIGHTS_CONFIRMED:'true',
  NEXT_PUBLIC_MAP_STYLE_URL:'https://tiles.example.net/style.json',
  NEXT_PUBLIC_DATA_MODE:'live', NEXT_PUBLIC_APP_MODE:'live',
  NEXT_PUBLIC_TURNSTILE_SITE_KEY:'real-site-key', TURNSTILE_SECRET_KEY:'private-turnstile-key',
  TURNSTILE_HOSTNAMES:site + '.com', RESEND_API_KEY:'private-email-key',
  INQUIRY_EMAIL_TO:'recipient@' + site + '.com', INQUIRY_EMAIL_FROM:'site@' + site + '.com',
  EMAIL_WORKER_SECRET:'private-worker-secret',
  API_BASE_URL:'https://project.supabase.co/functions/v1/api',
  BOOKING_API_KEY:'private-booking-key', BOOKING_CREDENTIAL_AFFILIATE_ID:'123',
  BOOKING_SEARCH_ENDPOINT:'https://demandapi.booking.com/3.1/accommodations/availability',
  BOOKING_ENDPOINT_VERIFIED_AT:'2026-10-03', BOOKING_RESPONSE_SCHEMA_VERIFIED:'true',
  AGODA_API_KEY:'private-agoda-key', AGODA_CREDENTIAL_AFFILIATE_ID:'456',
  AGODA_SEARCH_ENDPOINT:'https://api.agoda.com/search',
  AGODA_ENDPOINT_VERIFIED_AT:'2026-10-03', AGODA_RESPONSE_SCHEMA_VERIFIED:'true',
};
test('matching live origins and server settings pass configuration only, without claiming external verification', () => {
  assert.deepEqual(configurationErrors(base), []);
});
test('missing mode/credentials fail with field names, never secret values', () => {
  const errors = configurationErrors({});
  assert(errors.includes('missing:SUPABASE_SERVICE_ROLE_KEY'));
  assert(errors.some(e => e.endsWith('=live')));
  assert(!JSON.stringify(errors).includes('private-service-key'));
});
test('service key cannot become browser anon key', () => {
  assert(configurationErrors({...base, NEXT_PUBLIC_SUPABASE_ANON_KEY:base.SUPABASE_SERVICE_ROLE_KEY}).includes('public_key_is_service_key'));
  const jwt = 'header.' + Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url') + '.signature';
  assert(configurationErrors({...base, NEXT_PUBLIC_SUPABASE_ANON_KEY:jwt}).includes('public_key_is_service_role'));
  assert(configurationErrors({...base, NEXT_PUBLIC_SUPABASE_ANON_KEY:'sb_secret_another_secret'}).includes('public_key_is_not_publishable'));
});
test('wrong backend or CORS origin blocks production configuration', () => {
  assert(configurationErrors({...base, NEXT_PUBLIC_API_URL:'https://other.supabase.co/functions/v1/api'}).includes('supabase_api_base_mismatch'));
  assert(configurationErrors({...base, ALLOWED_ORIGINS:'https://other.com'}).includes('site_origin_missing_from_cors'));
  assert(configurationErrors({...base, ALLOWED_ORIGINS:'https://other.com, '+base.NEXT_PUBLIC_SITE_URL}).includes('site_origin_missing_from_cors'));
  if(site==='thaimora')assert(configurationErrors({...base, TURNSTILE_HOSTNAMES:'other.com, '+site+'.com'}).includes('site_hostname_missing_from_turnstile'));
  assert(configurationErrors({...base, NEXT_PUBLIC_SITE_URL:'http://localhost:3000'}).includes('https:NEXT_PUBLIC_SITE_URL'));
});
test('deployment requires explicit Vercel account/project or Cloudflare production branch', () => {
  assert(configurationErrors(base, 'vercel').includes('missing:VERCEL_ORG_ID'));
  assert.deepEqual(configurationErrors({...base,HOSTING_PROVIDER:'vercel',VERCEL_ORG_ID:'team',VERCEL_PROJECT_ID:'project'},'vercel'),[]);
  assert(configurationErrors(base, 'cloudflare').includes('missing:CLOUDFLARE_PRODUCTION_BRANCH'));
  assert.deepEqual(configurationErrors({...base,HOSTING_PROVIDER:'cloudflare',CLOUDFLARE_ACCOUNT_ID:'account',CLOUDFLARE_PROJECT_NAME:site,CLOUDFLARE_PRODUCTION_BRANCH:'main'},'cloudflare'),[]);
  assert(configurationErrors({...base,HOSTING_PROVIDER:'vercel',CLOUDFLARE_ACCOUNT_ID:'account',CLOUDFLARE_PROJECT_NAME:site,CLOUDFLARE_PRODUCTION_BRANCH:'main'},'cloudflare').includes('hosting_provider_target_mismatch'));
  assert(configurationErrors({...base,HOSTING_PROVIDER:'cloudflare',VERCEL_ORG_ID:'team',VERCEL_PROJECT_ID:'project'},'vercel').includes('hosting_provider_target_mismatch'));
});
test('unconfirmed provider/map rights and site-specific unsafe settings block configuration', () => {
  assert(configurationErrors({...base,GEOAPIFY_RIGHTS_CONFIRMED:'false'}).includes('GEOAPIFY_RIGHTS_CONFIRMED=true'));
  if (site === 'thaimora') assert(configurationErrors({...base,NEXT_PUBLIC_TURNSTILE_SITE_KEY:'1x00000000000000000000AA'}).includes('turnstile_test_key'));
  else {
    assert(configurationErrors({...base,BOOKING_RESPONSE_SCHEMA_VERIFIED:'false'}).includes('BOOKING_RESPONSE_SCHEMA_VERIFIED=true'));
    assert(configurationErrors({...base,API_BASE_URL:'https://other.supabase.co/functions/v1/api'}).includes('pages_api_base_mismatch'));
  }
});
