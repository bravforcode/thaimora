// Read-only checks against this project's authorized hosted functions only.
// No credentials, accounts, messages, charges, redirects, or provider requests.
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const BASE = 'https://hpjmttoxomdhxxsourih.supabase.co/functions/v1';
const PROJECT = 'thaimora';
const MAX_BODY_BYTES = 2_000_000;
const checks = [];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const safeCode = value => typeof value === 'string' && /^[a-z][a-z0-9_]{0,79}$/.test(value) ? value : null;

async function request(path, { method = 'GET', body, headers = {} } = {}) {
  if (!/^\/(?:api\/v1\/|stripe-webhook$|line-webhook$|deliver-contact$)/.test(path)
      || path.includes('..') || path.includes('?') || path.includes('#')) throw new Error('probe_path_rejected');
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 12_000);
  try {
    const response = await fetch(BASE + path, {
      method, redirect: 'error', signal: abort.signal,
      headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('non_json_response');
    const reader = response.body?.getReader();
    if (!reader) throw new Error('missing_response_body');
    const chunks = []; let length = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        length += value.byteLength;
        if (length > MAX_BODY_BYTES) throw new Error('response_too_large');
        chunks.push(value);
      }
    } finally { await reader.cancel().catch(() => undefined); }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    let data;
    try { data = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new Error('invalid_json_response'); }
    return { status: response.status, data, code: safeCode(data?.error?.code) };
  } finally { clearTimeout(timer); }
}

async function probe(name, path, init, verify) {
  try {
    const response = await request(path, init);
    const result = verify(response);
    const pass = Object.values(result).every(value => value === true);
    checks.push({ name, status: response.status, errorCode: response.code, pass, assertions: result });
    return response.data;
  } catch (error) {
    const known = new Set(['probe_path_rejected', 'non_json_response', 'missing_response_body', 'response_too_large', 'invalid_json_response']);
    checks.push({ name, status: null, errorCode: known.has(error?.message) ? error.message : 'probe_transport_failure', pass: false });
    return null;
  }
}

function denied({ status, data, code }) {
  return { authDenied: status === 401 || status === 403, safeError: code !== null,
    privatePayloadAbsent: object(data) && Object.keys(data).every(key => key === 'error') };
}

await probe('public_broker_config', '/api/v1/broker/config', {}, ({ status, data }) => ({
  success: status === 200,
  quotedUsd25Monthly: data?.monthlyPrice?.amountMinor === 2500 && String(data?.monthlyPrice?.currency).toUpperCase() === 'USD' && data?.monthlyPrice?.interval === 'month',
  noApprovalRequired: data?.approvalRequired === false,
  billingDisabled: data?.billingEnabled === false,
  registrationDisabledUntilApprovedTerms: data?.registrationEnabled === false && data?.termsVersion === null,
  contactDeliveryDisabled: data?.contactDeliveryEnabled === false,
  lineLinkDisabled: data?.lineLinkEnabled === false,
  configHasOnlyPublicFields: object(data) && Object.keys(data).every(key => [
    'billingEnabled', 'monthlyPrice', 'approvalRequired', 'termsVersion', 'registrationEnabled',
    'contactDeliveryEnabled', 'lineLinkEnabled', 'lineFriendUrl',
  ].includes(key)),
}));

for (const route of ['broker/me', 'broker/dashboard', 'broker/listings', 'broker/leads', 'contact/preferences', 'admin/brokers']) {
  await probe('unauthenticated_' + route.replaceAll('/', '_'), '/api/v1/' + route, {}, denied);
}
for (const route of ['broker/checkout', 'broker/portal', 'contact/line-link']) {
  await probe('unauthenticated_' + route.replaceAll('/', '_'), '/api/v1/' + route, { method: 'POST', body: {} }, denied);
}
await probe('forged_broker_token_denied', '/api/v1/broker/dashboard', { headers: { Authorization: 'Bearer invalid-smoke-token' } }, denied);

function webhookRejected({ status, data, code }) {
  return { closed: [400, 401, 503].includes(status), safeError: code !== null,
    noSuccessOrPrivatePayload: object(data) && Object.keys(data).every(key => key === 'error') };
}
await probe('stripe_missing_signature', '/stripe-webhook', { method: 'POST', body: {} }, webhookRejected);
await probe('stripe_invalid_signature', '/stripe-webhook', {
  method: 'POST', body: {}, headers: { 'Stripe-Signature': 't=1,v1=invalid' },
}, webhookRejected);
await probe('line_missing_signature', '/line-webhook', { method: 'POST', body: { events: [] } }, webhookRejected);
await probe('line_invalid_signature', '/line-webhook', {
  method: 'POST', body: { events: [] }, headers: { 'X-Line-Signature': 'invalid' },
}, webhookRejected);
await probe('contact_worker_missing_authorization', '/deliver-contact', { method: 'POST', body: {} }, denied);
await probe('contact_worker_invalid_authorization', '/deliver-contact', {
  method: 'POST', body: {}, headers: { Authorization: 'Bearer invalid-smoke-token' },
}, denied);
await probe('public_content_preserved', '/api/v1/content', {}, ({ status, data }) => ({
  success: status === 200, poiCountPreserved: Array.isArray(data?.pois) && data.pois.length === 1868,
  noPublishedEvents: Array.isArray(data?.events) && data.events.length === 0,
}));

const evidence = {
  project: PROJECT, checkedAt: new Date().toISOString(), scope: 'hosted_read_only_http',
  configurationExpected: 'accounts_and_delivery_disabled',
  checks, total: checks.length, passed: checks.filter(check => check.pass).length,
  failed: checks.filter(check => !check.pass).length,
  limitations: ['No authenticated broker flow or real provider delivery checked.', 'No frontend deployment or commercial hosting entitlement checked.'],
};
const output = new URL('../docs/evidence/feature-hosted-http.json', import.meta.url);
await mkdir(fileURLToPath(new URL('.', output)), { recursive: true });
await writeFile(output, JSON.stringify(evidence, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ project: PROJECT, total: evidence.total, passed: evidence.passed, failed: evidence.failed }));
if (evidence.failed > 0) process.exitCode = 1;
