import { gzipSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";
import { encodeSources, decodeArtifact, downloadArtifact, publishArtifact, validateManifest, MAX_SQL_BYTES, type SqlManifest } from "../../scripts/lib/sql-artifact.mjs";

const sources = {"schema.sql": "-- schema\n".repeat(30), "policies.sql": "-- policies\n".repeat(30), "group-match-workflow.sql": "-- transactions\n".repeat(30)};
const artifact = encodeSources(sources);
const manifest: SqlManifest = {formatVersion: 1, revision: "20260914-hardening", sha256: artifact.sha256, bucket: "groups-sql-artifacts", object: `${artifact.sha256}.json.gz`};
const env = {NEXT_PUBLIC_SUPABASE_URL_DEV: "https://testing.supabase.co", SUPABASE_SERVICE_ROLE_KEY_DEV: "test-service-key"};

describe("immutable private SQL artifacts", () => {
  it("restores exactly the revision's three canonical sources across line endings", () => {
    expect(decodeArtifact(artifact.gzip, manifest)).toEqual(sources);
    const windows = Object.fromEntries(Object.entries(sources).map(([key, value]) => [key, value.replaceAll("\n", "\r\n")]));
    expect(encodeSources(windows).sha256).toBe(artifact.sha256);
    const repeatedCarriageReturns = Object.fromEntries(Object.entries(sources).map(([key, value]) => [key, value.replaceAll("\n", "\r\r\n")]));
    const repaired = encodeSources(repeatedCarriageReturns);
    expect(repaired.sha256).toBe(artifact.sha256);
    expect(decodeArtifact(repaired.gzip, manifest)).toEqual(sources);
  });
  it("rejects another release and incomplete or oversized artifacts before returning SQL", () => {
    const newer = encodeSources({...sources, "schema.sql": `${sources["schema.sql"]}-- new migration`});
    expect(() => decodeArtifact(newer.gzip, manifest)).toThrow("hash");
    expect(() => decodeArtifact(gzipSync(JSON.stringify({"schema.sql": sources["schema.sql"]})), manifest)).toThrow("incompleta");
    expect(() => decodeArtifact(gzipSync(Buffer.alloc(MAX_SQL_BYTES + 1)), manifest)).toThrow();
    expect(() => decodeArtifact(Buffer.from("not gzip"), manifest)).toThrow();
  });
  it.each([{bucket: "public"}, {object: "../schema.sql"}, {sha256: "unverified"}, {revision: "../release"}, {formatVersion: 2}])("rejects malformed manifest %j", (change) => {
    expect(() => validateManifest({...manifest, ...change})).toThrow("Manifiesto");
  });
  it("downloads a private exact-hash object and refuses redirects and failed responses", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(new Uint8Array(artifact.gzip)));
    expect(await downloadArtifact(manifest, env, fetcher)).toEqual(artifact.gzip);
    expect(fetcher).toHaveBeenCalledWith(`https://testing.supabase.co/storage/v1/object/authenticated/groups-sql-artifacts/${manifest.sha256}.json.gz`, expect.objectContaining({redirect: "error", headers: {Authorization: "Bearer test-service-key", apikey: "test-service-key"}}));
    fetcher.mockResolvedValue(new Response("denied", {status: 403}));
    await expect(downloadArtifact(manifest, env, fetcher)).rejects.toThrow("HTTP 403");
    fetcher.mockClear();
    await expect(downloadArtifact(manifest, {...env, NEXT_PUBLIC_SUPABASE_URL_DEV: "https://attacker.example"}, fetcher)).rejects.toThrow("URL");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("publishes once and verifies retries without overwriting an existing object", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response("exists", {status: 409})).mockResolvedValueOnce(new Response(new Uint8Array(artifact.gzip)));
    await expect(publishArtifact(artifact.gzip, manifest, env, fetcher)).resolves.toBeUndefined();
    expect(fetcher.mock.calls[0][1]).toMatchObject({method: "POST", headers: {"x-upsert": "false"}});
    expect(fetcher).toHaveBeenCalledTimes(2);
    const corrupted = encodeSources({...sources, "schema.sql": `${sources["schema.sql"]}different`});
    fetcher.mockReset().mockResolvedValueOnce(new Response("exists", {status: 409})).mockResolvedValueOnce(new Response(new Uint8Array(corrupted.gzip)));
    await expect(publishArtifact(artifact.gzip, manifest, env, fetcher)).rejects.toThrow("hash");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("keeps old release manifests independently restorable after a new release", () => {
    const next = encodeSources({...sources, "schema.sql": `${sources["schema.sql"]}-- next revision`});
    const nextManifest = {...manifest, revision: "20260915-next", sha256: next.sha256, object: `${next.sha256}.json.gz`};
    expect(decodeArtifact(artifact.gzip, manifest)).toEqual(sources);
    expect(decodeArtifact(next.gzip, nextManifest)["schema.sql"]).toContain("next revision");
    expect(() => decodeArtifact(next.gzip, manifest)).toThrow("hash");
  });
});
