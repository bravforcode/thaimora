import {describe,it,expect} from "vitest";
import {spawnSync} from "node:child_process";
import {resolve} from "node:path";
describe("production versus preview execution",()=>{
 const script=resolve("scripts/production-gate.mjs");
 const base={PATH:process.env.PATH,SystemRoot:process.env.SystemRoot};
 it("allows explicit fixture previews without accounts, domains or legal signoff",()=>{const result=spawnSync(process.execPath,[script],{env:base,encoding:"utf8"});expect(result.status).toBe(0);expect(result.stdout).toContain("preview");});
 it("rejects explicit production invocation in preview mode",()=>{const result=spawnSync(process.execPath,[script,"--production"],{env:base,encoding:"utf8"});expect(result.status).toBe(1);expect(result.stderr).toContain("Production requires");});
 it("rejects live mode without reviewed launch evidence",()=>{const result=spawnSync(process.execPath,[script,"--production","scripts/no-such-launch-evidence.json"],{env:{...base,NEXT_PUBLIC_DATA_MODE:"live"},encoding:"utf8"});expect(result.status).toBe(1);expect(result.stderr).toContain("missing reviewed launch evidence");});
});
