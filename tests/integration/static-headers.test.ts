import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
const config=JSON.parse(readFileSync(new URL('../../vercel.json',import.meta.url),'utf8'));
describe('static hosting security headers',()=>{
 it('serves every route with a restrictive CSP, framing, MIME, referrer, transport and permission controls',()=>{
  const rule=config.headers.find((h:{source:string})=>h.source==='/(.*)');
  const headers=Object.fromEntries(rule.headers.map((h:{key:string;value:string})=>[h.key,h.value]));
  expect(headers['X-Content-Type-Options']).toBe('nosniff');
  expect(headers['X-Frame-Options']).toBe('DENY');
  expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['Strict-Transport-Security']).toMatch(/max-age=31536000/);
  expect(headers['Permissions-Policy']).toContain('camera=()');
  const csp=headers['Content-Security-Policy'];
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("base-uri 'self'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).not.toMatch(/script-src[^;]*'unsafe-eval'/);
 });
});
