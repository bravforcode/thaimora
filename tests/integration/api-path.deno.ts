import {apiParts} from '../../supabase/functions/_shared/api-path.ts';
import {auditMutation} from '../../supabase/functions/_shared/admin-input.ts';
function equal(a:unknown,b:unknown){if(JSON.stringify(a)!==JSON.stringify(b))throw new Error('Unexpected decoded API path');}
Deno.test('encoded source IDs remain one exact segment for staff content routes',()=>{
 for(const id of ['organizer-json:a','osm:node:123','source/id','source%3Aid']){
  equal(apiParts(new URL('https://site.test/functions/v1/api/v1/admin/events/'+encodeURIComponent(id)+'/automation')),['admin','events',id,'automation']);
 }
});
Deno.test('full115-character source IDs reach the audit RPC without truncation',async()=>{
 const id='organizer-json:'+'a'.repeat(100);let called=false;
 const db={rpc:async(name:string,args:Record<string,unknown>)=>{called=true;equal(name,'record_admin_audit');equal(args.p_id,id);return {error:null};}};
 await auditMutation(db,'synthetic-actor','events',id,'UPDATE',['name']);equal(called,true);
});
Deno.test('worker-relative paths and missing API prefixes parse safely',()=>{
 equal(apiParts(new URL('https://site.test/api/v1/content')),['content']);
 equal(apiParts(new URL('https://site.test/admin/events')),[]);
});
Deno.test('malformed encoding, control characters and oversized IDs fail closed',()=>{
 for(const id of ['%ZZ','%E0%A4','%00','%0A','a'.repeat(201)]){
  try{apiParts(new URL('https://site.test/api/v1/admin/events/'+id));}catch(error){if(error instanceof Error&&'status' in error&&error.status===422)continue;throw error;}
  throw new Error('Invalid path was accepted');
 }
});
