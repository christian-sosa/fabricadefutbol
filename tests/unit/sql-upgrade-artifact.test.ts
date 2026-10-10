import { gzipSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";
import { encodeSources } from "../../scripts/lib/sql-artifact.mjs";
import { decodeUpgradeArtifact, encodeUpgradeSources, MAX_UPGRADE_BYTES, publishUpgradeArtifact, UPGRADE_FILES, UPGRADE_MIGRATIONS, validateUpgradeManifest, type SqlUpgradeManifest } from "../../scripts/lib/sql-upgrade-artifact.mjs";

const sources = Object.fromEntries(UPGRADE_FILES.map((name)=>[name,`-- recorded ${name}\n`.repeat(20)]));
const artifact = encodeUpgradeSources(sources);
const baselineManifest = (release: string) => {
  const canonical = Object.fromEntries(["schema.sql","policies.sql","group-match-workflow.sql"].map((name)=>[name,sources[`${release}-baseline/${name}`]]));
  const encoded=encodeSources(canonical);
  return {formatVersion:1 as const,revision:`previous-${release}-release`,sha256:encoded.sha256,bucket:"groups-sql-artifacts" as const,object:`${encoded.sha256}.json.gz`};
};
const manifest:SqlUpgradeManifest = {formatVersion:1,artifactKind:"sql-upgrades",revision:"recorded-upgrade-fixture",sha256:artifact.sha256,bucket:"groups-sql-artifacts",object:`${artifact.sha256}.json.gz`,fileSha256:artifact.fileSha256,baselines:{audit:baselineManifest("audit"),positions:baselineManifest("positions")},migrations:Object.fromEntries(Object.keys(UPGRADE_MIGRATIONS).map((key)=>[key,{version:"20261007154147",name:`recorded_${key.toLowerCase()}`}]))};
const env={NEXT_PUBLIC_SUPABASE_URL_DEV:"https://testing.supabase.co",SUPABASE_SERVICE_ROLE_KEY_DEV:"test-service-key"};
describe("private recorded upgrade artifacts",()=>{
  it("binds every previous source and deployed migration to the revision",()=>{
    expect(decodeUpgradeArtifact(artifact.gzip,manifest)).toEqual(sources);
    const changed=encodeUpgradeSources({...sources,"positions-migrations/app_prod.sql":sources["positions-migrations/app_prod.sql"]+"-- changed"});
    expect(()=>decodeUpgradeArtifact(changed.gzip,manifest)).toThrow("hashes");
    expect(()=>decodeUpgradeArtifact(artifact.gzip,{...manifest,fileSha256:{...manifest.fileSha256,"positions-migrations/app_prod.sql":"0".repeat(64)}})).toThrow("hashes");
  });
  it("rejects substituting another released baseline even when payload hashes match",()=>{
    const other=baselineManifest("audit");
    expect(()=>decodeUpgradeArtifact(artifact.gzip,{...manifest,baselines:{...manifest.baselines,positions:other}})).toThrow("Baseline historico");
  });
  it("rejects missing migrations, unexpected paths and incomplete provenance",()=>{
    const missing={...sources};delete missing["positions-migrations/app_dev.sql"];
    expect(()=>encodeUpgradeSources(missing)).toThrow("incompletas");
    expect(()=>encodeUpgradeSources({...sources,"../../schema.sql":"x".repeat(200)})).toThrow("inesperadas");
    expect(()=>validateUpgradeManifest({...manifest,migrations:{}})).toThrow("Proveniencia");
    expect(()=>validateUpgradeManifest({...manifest,migrations:{...manifest.migrations,positionsDev:{version:"made-up",name:"positions_dev"}}})).toThrow("Historia");
  });
  it("rejects oversized compressed payloads before reading private SQL",()=>{
    expect(()=>decodeUpgradeArtifact(gzipSync(Buffer.alloc(MAX_UPGRADE_BYTES+1)),manifest)).toThrow();
  });
  it("omits malformed private content from decoding errors",()=>{
    const privateSql="PRIVATE SQL SOURCE MUST NOT APPEAR";
    try { decodeUpgradeArtifact(gzipSync(Buffer.from(privateSql)),manifest); }
    catch (error) {
      expect(String(error)).not.toContain(privateSql);
      expect(error).not.toHaveProperty("cause");
      return;
    }
    throw new Error("Expected malformed artifact rejection");
  });
  it("does not overwrite an existing release and verifies retry contents",async()=>{
    const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(new Response("exists",{status:409})).mockResolvedValueOnce(new Response(new Uint8Array(artifact.gzip)));
    await expect(publishUpgradeArtifact(artifact.gzip,manifest,env,fetcher)).resolves.toBeUndefined();
    expect(fetcher.mock.calls[0][1]).toMatchObject({method:"POST",headers:{"x-upsert":"false"}});
    const changed=encodeUpgradeSources({...sources,"positions-migrations/app_prod.sql":sources["positions-migrations/app_prod.sql"]+"-- changed"});
    fetcher.mockReset().mockResolvedValueOnce(new Response("exists",{status:409})).mockResolvedValueOnce(new Response(new Uint8Array(changed.gzip)));
    await expect(publishUpgradeArtifact(artifact.gzip,manifest,env,fetcher)).rejects.toThrow("hashes");
  });
});
