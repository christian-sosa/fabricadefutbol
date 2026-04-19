import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

const sharedCoverage = {
  provider: "v8" as const,
  reporter: ["text", "html", "json-summary"],
  reportsDirectory: "coverage",
  include: [
    "src/lib/domain/team-generator.ts",
    "src/lib/domain/rating.ts",
    "src/lib/domain/billing.ts",
    "src/lib/rate-limit.ts",
    "src/lib/payments/mercadopago.ts",
    "src/lib/org.ts",
    "src/lib/errors.ts",
    "src/lib/queries/public.ts",
    "src/lib/domain/billing-workflow.ts",
    "src/lib/domain/match-workflow.ts",
    "src/app/api/payments/mercadopago/webhook/route.ts",
    "src/components/admin/new-match-form.tsx",
    "src/components/admin/match-result-editor.tsx"
  ],
  thresholds: {
    lines: 0,
    functions: 0,
    branches: 0,
    statements: 0,
    "src/lib/domain/team-generator.ts": {
      lines: 80,
      functions: 80,
      branches: 70,
      statements: 78
    },
    "src/lib/domain/rating.ts": {
      lines: 80,
      functions: 80,
      branches: 70,
      statements: 80
    },
    "src/lib/domain/billing.ts": {
      lines: 80,
      functions: 80,
      branches: 70,
      statements: 80
    },
    "src/lib/domain/billing-workflow.ts": {
      lines: 80,
      functions: 80,
      branches: 70,
      statements: 80
    },
    "src/lib/rate-limit.ts": {
      lines: 80,
      functions: 80,
      branches: 70,
      statements: 80
    },
    "src/lib/org.ts": {
      lines: 80,
      functions: 80,
      branches: 70,
      statements: 80
    },
    "src/lib/payments/mercadopago.ts": {
      lines: 80,
      functions: 80,
      branches: 70,
      statements: 80
    },
    "src/app/api/payments/mercadopago/webhook/route.ts": {
      lines: 80,
      functions: 80,
      branches: 70,
      statements: 80
    },
    "src/components/admin/match-result-editor.tsx": {
      lines: 80,
      functions: 80,
      branches: 70,
      statements: 80
    }
  }
};

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: [
      {
        find: /^@\//,
        replacement: `${fileURLToPath(new URL("./src/", import.meta.url)).replace(/\\/g, "/")}/`
      }
    ]
  },
  test: {
    globals: true,
    setupFiles: ["tests/setup/vitest.setup.ts"],
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"]
        }
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"]
        }
      },
      {
        extends: true,
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["tests/ui/**/*.test.tsx"]
        }
      }
    ],
    coverage: sharedCoverage
  }
});
