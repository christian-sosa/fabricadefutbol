import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("e2e environment preflight source", () => {
  it("runs before Playwright and documents the required local test env", () => {
    const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
    const scriptPath = path.join(root, "scripts", "check-e2e-env.mjs");

    expect(existsSync(scriptPath)).toBe(true);
    expect(packageJson.scripts["test:e2e:preflight"]).toBe("node scripts/check-e2e-env.mjs");
    expect(packageJson.scripts["test:e2e"]).toBe("npm run test:e2e:preflight && playwright test");

    const scriptSource = readFileSync(scriptPath, "utf8");
    for (const envName of [
      "SUPABASE_TARGET_ENV",
      "NEXT_PUBLIC_SUPABASE_URL_DEV",
      "NEXT_PUBLIC_SUPABASE_DB_SCHEMA_DEV",
      "SUPABASE_SERVICE_ROLE_KEY_DEV",
      "E2E_BASE_URL",
      "E2E_ADMIN_EMAIL",
      "E2E_ADMIN_PASSWORD",
      "E2E_ORG_SLUG"
    ]) {
      expect(scriptSource).toContain(envName);
    }
    expect(scriptSource).toContain("production");
    expect(scriptSource).not.toContain("SUPABASE_SERVICE_ROLE_KEY_PROD");
  });
});
