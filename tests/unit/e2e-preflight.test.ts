import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readE2eEnvironment, validateE2eEnvironment } from "../../scripts/lib/e2e-env.mjs";

function valid() {
  return {
    NEXT_PUBLIC_SUPABASE_TARGET_ENV: "development",
    NEXT_PUBLIC_SUPABASE_URL_DEV: "https://testing.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY_DEV: "public-test-key",
    SUPABASE_SERVICE_ROLE_KEY_DEV: "private-test-key",
    NEXT_PUBLIC_SUPABASE_DB_SCHEMA_DEV: "app_dev",
    E2E_BASE_URL: "http://127.0.0.1:3001", APP_URL_DEV: "http://127.0.0.1:3001", NEXT_PUBLIC_APP_URL_DEV: "http://127.0.0.1:3001",
    E2E_ADMIN_EMAIL: "fixture@example.test", E2E_ADMIN_PASSWORD: "disposable-test-password",
    E2E_ADMIN_USER_ID: "00000000-0000-4000-8000-000000000001", E2E_ORG_SLUG: "e2e-tests"
  };
}
const directories: string[] = [];
afterEach(() => { for (const dir of directories.splice(0)) rmSync(dir, {recursive: true, force: true}); });

describe("E2E preflight behavior", () => {
  it("accepts the isolated configuration and explicitly requested new users", () => {
    expect(validateE2eEnvironment(valid())).toMatchObject({NEXT_PUBLIC_SUPABASE_DB_SCHEMA_DEV: "app_dev"});
    expect(() => validateE2eEnvironment({...valid(), E2E_ADMIN_USER_ID: undefined, E2E_CREATE_FIXTURE_USER: "1"})).not.toThrow();
  });
  it.each([
    ["NEXT_PUBLIC_SUPABASE_TARGET_ENV", "production"], ["SUPABASE_TARGET_ENV", "production"],
    ["NEXT_PUBLIC_SUPABASE_DB_SCHEMA_DEV", "app_prod"], ["E2E_ADMIN_EMAIL", "admin@real.example"],
    ["E2E_ORG_SLUG", "real-group"], ["E2E_BASE_URL", "https://real.example:3001"],
    ["APP_URL_DEV", "https://real.example"], ["NEXT_PUBLIC_APP_URL_DEV", "http://localhost:3002"],
    ["E2E_ADMIN_USER_ID", "not-a-user"], ["SUPABASE_SERVICE_ROLE_KEY_DEV", "${SUPABASE_SERVICE_ROLE_KEY_DEV}"],
    ["E2E_ORG_NAME", "${E2E_ORG_NAME}"], ["NEXT_PUBLIC_SUPABASE_URL_DEV", "https://supabase.co.attacker.example"],
    ["E2E_BASE_URL", "http://user:secret@localhost:3001"], ["E2E_BASE_URL", "http://localhost:3001/real-app"],
    ["E2E_ADMIN_PASSWORD", "short"]
  ])("rejects unsafe %s configuration without exposing values", (key, value) => {
    expect(() => validateE2eEnvironment({...valid(), [key]: value})).toThrow();
  });
  it("does not treat missing credentials or an unaccredited existing email as optional", () => {
    expect(() => validateE2eEnvironment({...valid(), SUPABASE_SERVICE_ROLE_KEY_DEV: ""})).toThrow("Falta SUPABASE_SERVICE_ROLE_KEY_DEV");
    expect(() => validateE2eEnvironment({...valid(), E2E_ADMIN_USER_ID: undefined})).toThrow("E2E_ADMIN_USER_ID");
    expect(() => validateE2eEnvironment({...valid(), NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY_DEV: undefined})).toThrow("clave publica");
    try { validateE2eEnvironment({...valid(), NEXT_PUBLIC_SUPABASE_TARGET_ENV: "production"}); }
    catch (error) { expect(String(error)).not.toContain(valid().SUPABASE_SERVICE_ROLE_KEY_DEV); }
  });
  it("uses explicit process values over local files and leaves unresolved templates for rejection", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "fdf-preflight-test-")); directories.push(directory);
    const filepath = path.join(directory, ".env.test");
    writeFileSync(filepath, '# comment\nE2E_ORG_NAME="Demo group"\nE2E_ADMIN_PASSWORD="secret=with=equals"\nE2E_ORG_SLUG=${E2E_ORG_SLUG}\n');
    const env = readE2eEnvironment({E2E_ORG_NAME: "CI group", E2E_ADMIN_PASSWORD: ""}, filepath);
    expect(env).toEqual({E2E_ORG_NAME: "CI group", E2E_ADMIN_PASSWORD: "secret=with=equals", E2E_ORG_SLUG: "${E2E_ORG_SLUG}"});
    expect(() => validateE2eEnvironment({...valid(), ...env})).toThrow("placeholder");
  });
});
