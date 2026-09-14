import { defineConfig, devices } from "@playwright/test";
import { loadEnvFile } from "./tests/helpers/load-env-file";

loadEnvFile(".env.test");

const baseURL = process.env.E2E_BASE_URL?.trim() || "http://127.0.0.1:3001";
const reportProject = process.env.E2E_REPORT_PROJECT || "all";
if (!process.env.E2E_RUN_TOKEN) throw new Error("Usa npm run test:e2e para validar la version compilada con exclusion mutua.");

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  outputDir: `test-results/${reportProject}`,
  timeout: 60_000,
  expect: {
    timeout: 15_000
  },
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: `playwright-report/${reportProject}` }]
  ],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"]
      }
    },
    { name: "mobile-chromium", use: {...devices["Pixel 7"]} }
  ],
  webServer: {
    command: `"${process.execPath}" node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port ${new URL(baseURL).port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000
  }
});
