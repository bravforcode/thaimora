import {describe,it,expect} from 'vitest';
import {unsafeExport,privateData} from '../../scripts/lib/export-safety';
import {capRows} from '../../supabase/functions/_shared/admin-input.ts';
describe('admin list caps',()=>{
 it('reports truncation instead of silently dropping rows',()=>{
  expect(capRows([1,2,3],2)).toEqual({rows:[1,2],truncated:true});
  expect(capRows([1,2],2)).toEqual({rows:[1,2],truncated:false});
 });
});
describe('production data versus administrator schema',()=>{
 it('allows legitimate compiled admin fields but rejects private exported data',()=>{
  expect(unsafeExport('admin.js','JSON.stringify({ownership_evidence:value,exact_publication_consent:true,consent_evidence:input})')).toBe(false);
  expect(unsafeExport('catalog.json','{"properties":[{"privateLocation":{"lat":7.912345,"lng":98.312345}}]}')).toBe(true);
  expect(privateData({properties:[{location:{lat:7.9,lng:98.3,accuracy:'approximate'}}]})).toBe(false);
 });
 it('blocks actual secret values and service tokens while permitting public anonymous tokens',()=>{
  const token=(role:string)=>'eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({role})).toString('base64url')+'.signature';
  expect(unsafeExport('main.js',token('service_role'))).toBe(true);expect(unsafeExport('main.js',token('anon'))).toBe(false);
  expect(unsafeExport('catalog.json',JSON.stringify({description:token('service_role')}))).toBe(true);
  expect(unsafeExport('main.js','some_private_key_value',['some_private_key_value'])).toBe(true);
 });
});
