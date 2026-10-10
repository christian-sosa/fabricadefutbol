import { describe, expect, it } from "vitest";
import { assertLoopbackSocket, localConcurrencyDatabase, preserveFailureDuringCleanup, PrivatePostgresError } from "../../scripts/lib/postgres-concurrency.mjs";

describe("isolated PostgreSQL concurrency boundary", () => {
  it.each(["127.0.0.1", "localhost", "[::1]"])("accepts only the named local synthetic database on %s", (host) => {
    expect(localConcurrencyDatabase({ TEST_DATABASE_URL: `postgresql://postgres:ci-only@${host}:5433/fdf_test_concurrency` }))
      .toMatchObject({ host: host === "[::1]" ? "::1" : host, port: 5433, database: "fdf_test_concurrency", ssl: false });
  });
  it.each([
    "postgresql://postgres:ci-only@db.example.test/fdf_test_concurrency",
    "postgresql://postgres:ci-only@127.0.0.1/postgres",
    "postgresql://postgres:ci-only@127.0.0.1/fdf_test_concurrency?host=db.example.test",
    "postgresql://postgres:ci-only@127.0.0.1/fdf_test_concurrency?sslmode=require",
    "postgresql://postgres:ci-only@127.0.0.1/fdf_test_concurrency#other",
    "https://postgres:ci-only@127.0.0.1/fdf_test_concurrency",
    "postgresql://127.0.0.1/fdf_test_concurrency",
    "postgresql://postgres:ci-only@127.0.0.1/fdf_test_concurrency/",
    "invalid"
  ])("rejects a remote, ambiguous or nonsynthetic target before connecting", (url) => {
    expect(() => localConcurrencyDatabase({ TEST_DATABASE_URL: url })).toThrow();
  });
  it("cannot claim full concurrency evidence in fast mode", () => {
    expect(() => localConcurrencyDatabase({ TEST_DATABASE_URL: "postgresql://postgres@127.0.0.1/fdf_test_concurrency", FDF_TEST_MODE: "fast" })).toThrow(/parcial/);
  });
  it("accepts the loopback TCP peer even when Docker forwards it to another server interface", () => {
    for (const address of ["127.0.0.1", "::1", "::ffff:127.0.0.1"]) {
      expect(() => assertLoopbackSocket(address)).not.toThrow();
    }
    for (const address of ["172.17.0.2", "10.0.0.5", "203.0.113.1", "localhost", undefined]) {
      expect(() => assertLoopbackSocket(address)).toThrow(/loopback/);
    }
  });
  it("retains SQLSTATE without exposing query bodies, credentials or driver detail", () => {
    const error = new PrivatePostgresError("Carrera sintetica", { code: "42501", message: "PRIVATE SQL AND PASSWORD", detail: "PRIVATE QUERY", query: "PRIVATE SOURCE" });
    expect(error.code).toBe("42501");
    expect(error.label).toBe("Carrera sintetica");
    expect(error.message).toBe("Carrera sintetica fallo (SQLSTATE 42501); consulta y fuente privadas omitidas.");
    expect(error).not.toHaveProperty("cause");
    expect(new PrivatePostgresError("Conexion", { code: "SECRET-TOKEN" }).code).toBe("unknown");
  });
  it("preserves the original failure when recovery succeeds", async () => {
    const original = new PrivatePostgresError("Guardar resultado", { code: "42501", message: "PRIVATE SOURCE" });
    let recovered = false;
    await expect(preserveFailureDuringCleanup(async () => { throw original; }, async () => { recovered = true; })).rejects.toBe(original);
    expect(recovered).toBe(true);
  });
  it("reports both sanitized SQL failures when recovery also fails", async () => {
    const original = new PrivatePostgresError("Guardar resultado", { code: "42501", message: "PRIVATE SOURCE" });
    const cleanup = new PrivatePostgresError("Rollback sintetico", { code: "57014", query: "PRIVATE QUERY" });
    const failure = await preserveFailureDuringCleanup(async () => { throw original; }, async () => { throw cleanup; }).catch((error: Error) => error);
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toContain("Guardar resultado fallo (SQLSTATE 42501)");
    expect((failure as Error).message).toContain("Rollback sintetico fallo (SQLSTATE 57014)");
    expect((failure as Error).message).not.toContain("PRIVATE");
    expect(failure).not.toHaveProperty("cause");
  });
  it("retains each sanitized SQLSTATE across nested recovery failures", async () => {
    const primary = new PrivatePostgresError("Guardar resultado", { code: "42501", message: "PRIVATE SOURCE" });
    const inner = new PrivatePostgresError("Rollback carrera", { code: "57014", query: "PRIVATE QUERY" });
    const outer = new PrivatePostgresError("Cleanup base", { code: "08006", detail: "PRIVATE DETAIL" });
    const failure = await preserveFailureDuringCleanup(
      () => preserveFailureDuringCleanup(async () => { throw primary; }, async () => { throw inner; }),
      async () => { throw outer; }
    ).catch((error: Error) => error);
    for (const code of ["42501", "57014", "08006"]) expect((failure as Error).message).toContain(`SQLSTATE ${code}`);
    expect((failure as Error).message).not.toContain("PRIVATE");
    expect(failure).not.toHaveProperty("cause");
  });
});
