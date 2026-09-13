import { afterEach, describe, expect, it, vi } from "vitest";

const variables = ["NEXT_PUBLIC_SUPABASE_TARGET_ENV", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL_DEV", "NEXT_PUBLIC_SUPABASE_URL_PROD", "NEXT_PUBLIC_SUPABASE_DB_SCHEMA_DEV", "NEXT_PUBLIC_SUPABASE_DB_SCHEMA", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY_DEV"];
async function envModule(values: Record<string, string>) {
  vi.resetModules();
  for (const name of variables) vi.stubEnv(name, values[name] ?? "");
  vi.stubEnv("NODE_ENV", values.NODE_ENV ?? "test");
  return import("@/lib/env");
}
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

describe("Supabase environment isolation", () => {
  it("does not fall back to production credentials in development", async () => {
    const env = await envModule({ NEXT_PUBLIC_SUPABASE_URL: "https://production.example", SUPABASE_SERVICE_ROLE_KEY: "production-only" });
    expect(() => env.getSupabaseUrl()).toThrow("Falta la URL");
    expect(env.getSupabaseServiceRoleKey()).toBeNull();
    expect(env.getSupabaseDbSchema()).toBe("app_dev");
  });
  it("uses an explicit build target equally for server and public configuration", async () => {
    const env = await envModule({ NODE_ENV: "production", NEXT_PUBLIC_SUPABASE_TARGET_ENV: "development", NEXT_PUBLIC_SUPABASE_URL_DEV: "https://development.example" });
    expect(env.getSupabaseUrl()).toBe("https://development.example");
    expect(env.getSupabaseDbSchema()).toBe("app_dev");
    expect(env.getPlayerPhotosBucket()).toBe("player-photos-dev");
  });
  it("rejects contradictory schema and invalid targets", async () => {
    const env = await envModule({ NEXT_PUBLIC_SUPABASE_TARGET_ENV: "development", NEXT_PUBLIC_SUPABASE_DB_SCHEMA_DEV: "app_prod" });
    expect(() => env.getSupabaseDbSchema()).toThrow("app_dev");
    const invalid = await envModule({ NEXT_PUBLIC_SUPABASE_TARGET_ENV: "anything" });
    expect(() => invalid.getSupabaseTargetEnv()).toThrow("development o production");
  });
  it("does not use development URL in production", async () => {
    const env = await envModule({ NODE_ENV: "production", NEXT_PUBLIC_SUPABASE_URL_DEV: "https://development.example" });
    expect(() => env.getSupabaseUrl()).toThrow("Falta la URL");
    expect(env.getSupabaseDbSchema()).toBe("app_prod");
  });
});
