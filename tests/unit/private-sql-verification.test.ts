import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assertPrivateSqlSources, verifyPrivateSql } from "../../scripts/check-private-sql.mjs";
import { encodeSources, SQL_FILES } from "../../scripts/lib/sql-artifact.mjs";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture() {
  mkdirSync("tmp/private-sql-tests", {recursive:true});
  const root = mkdtempSync(path.join(process.cwd(), "tmp/private-sql-tests/canonical-"));
  roots.push(root);
  mkdirSync(path.join(root,"config")); mkdirSync(path.join(root,"supabase"));
  const sources = Object.fromEntries(SQL_FILES.map((name) => [name, `-- ${name}\n`.repeat(30)]));
  const artifact = encodeSources(sources);
  const manifest = {formatVersion:1,revision:"verification-fixture",sha256:artifact.sha256,bucket:"groups-sql-artifacts",object:`${artifact.sha256}.json.gz`};
  writeFileSync(path.join(root,"config/sql-artifact-manifest.json"),JSON.stringify(manifest));
  for (const name of SQL_FILES) writeFileSync(path.join(root,"supabase",name),sources[name]);
  return {root,sources};
}
describe("complete private SQL verification",()=>{
  it("rejects changed local sources before generated files can hide them",()=>{
    const {root,sources}=fixture();
    expect(assertPrivateSqlSources(root)).toEqual(sources);
    writeFileSync(path.join(root,"supabase/schema.sql"),sources["schema.sql"]+"-- uncommitted change");
    expect(()=>assertPrivateSqlSources(root)).toThrow("no coinciden");
  });
  it("rejects a missing canonical source independently of CI",()=>{
    const {root}=fixture(); rmSync(path.join(root,"supabase/policies.sql"));
    expect(()=>assertPrivateSqlSources(root)).toThrow();
  });
  it("requires the private upgrade bundle during complete verification",()=>{
    const {root}=fixture();
    expect(()=>verifyPrivateSql(root)).toThrow();
    expect(readFileSync(path.join(root,"supabase/schema.sql"),"utf8")).toContain("schema.sql");
  });
  it("rejects inherited fast mode rather than report complete verification",()=>{
    const {root}=fixture(); vi.stubEnv("FDF_TEST_MODE","fast");
    try { expect(()=>verifyPrivateSql(root)).toThrow("no admite"); }
    finally { vi.unstubAllEnvs(); }
  });
});
