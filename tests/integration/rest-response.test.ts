import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {rest} from '../../scripts/lib/db';
beforeEach(()=>{
 vi.stubEnv('SUPABASE_URL','https://synthetic-db.invalid');
 vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','synthetic-private-test-key');
});
afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();});
describe('PostgREST response semantics',()=>{
 it('accepts a 201 response with no body for return=minimal writes',async()=>{
  vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(null,{status:201}));
  await expect(rest('fx_rates',{method:'POST',headers:{Prefer:'return=minimal'},body:'{}'})).resolves.toBeNull();
 });
 it('preserves returned representations',async()=>{
  vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('[{"id":"synthetic"}]',{status:201}));
  await expect(rest('sync_runs',{method:'POST'})).resolves.toEqual([{id:'synthetic'}]);
 });
 it('accepts 204 updates',async()=>{
  vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(null,{status:204}));
  await expect(rest('sync_runs',{method:'PATCH'})).resolves.toBeNull();
 });
 it('rejects unsuccessful writes without exposing the response or credentials',async()=>{
  vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('synthetic-private-error',{status:403}));
  await expect(rest('fx_rates',{method:'POST'})).rejects.toThrow('Database request failed: 403');
 });
 it('rejects malformed nonempty JSON',async()=>{
  vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('{',{status:200}));
  await expect(rest('sync_runs')).rejects.toThrow(SyntaxError);
 });
});
