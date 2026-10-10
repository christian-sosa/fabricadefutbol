import { describe, expect, it } from "vitest";
import { executePrivateSql, privateSqlAvailable } from "../helpers/private-sql";

describe("private SQL CI boundary", () => {
  it("fails complete local and CI runs instead of reporting missing SQL as successful", () => {
    const absent = "tmp/nonexistent-private-schema-for-loader-test.sql";
    expect(() => privateSqlAvailable(absent, "full")).toThrow("mandatory private SQL");
    expect(() => privateSqlAvailable(absent, "")).toThrow("mandatory private SQL");
    expect(privateSqlAvailable(absent, "fast")).toBe(false);
  });
  it("omits SQL only in explicit fast mode, even when sources are present", () => {
    expect(privateSqlAvailable("package.json", "fast")).toBe(false);
    expect(privateSqlAvailable("package.json", "full")).toBe(true);
    expect(() => privateSqlAvailable("package.json", "partial")).toThrow("Unknown");
  });
  it("does not expose the driver query, cause or multiline SQL when initialization fails", async () => {
    const sql = "PRIVATE FULL SCHEMA SHOULD NEVER APPEAR";
    const failure = Object.assign(new Error("duplicate relation\n" + sql), {code: "42P07", query: sql, cause: {query: sql}});
    try { await executePrivateSql({exec: async () => {throw failure;}}, sql, "schema.app_dev.sql"); }
    catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(String(error)).toContain("42P07");
      expect(String(error)).not.toContain(sql);
      expect(error).not.toHaveProperty("query");
      expect(error).not.toHaveProperty("cause");
      return;
    }
    throw new Error("Expected initialization to fail");
  });
});
