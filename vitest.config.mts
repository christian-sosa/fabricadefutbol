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
    "src/lib/rate-limit.ts",
    "src/lib/org.ts",
    "src/lib/errors.ts",
    "src/lib/queries/public.ts",
    "src/lib/domain/match-workflow.ts",
    "src/lib/domain/organization-workflow.ts",
    "src/lib/domain/organization-photo-retention.ts",
    "src/lib/domain/media-cleanup.ts",
    "src/lib/auth/admin.ts",
    "src/lib/auth/super-admin.ts",
    "src/lib/auth/mfa.ts",
    "src/lib/shared-rate-limit.ts",
    "src/lib/env.ts",
    "src/lib/query/client.ts",
    "src/app/api/player-photo/[id]/route.ts",
    "src/components/admin/new-match-form.tsx",
    "src/components/admin/match-result-editor.tsx"
  ],
  thresholds: {
    lines: 65,
    functions: 65,
    branches: 50,
    statements: 60,
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
    "src/lib/domain/match-workflow.ts": { lines: 70, functions: 75, branches: 50, statements: 68 },
    "src/lib/queries/public.ts": { lines: 70, functions: 75, branches: 48, statements: 65 },
    "src/lib/shared-rate-limit.ts": { lines: 85, functions: 90, branches: 80, statements: 85 },
    "src/lib/auth/mfa.ts": { lines: 90, functions: 90, branches: 80, statements: 90 },
    "src/lib/auth/admin.ts": { lines: 60, functions: 60, branches: 40, statements: 60 },
    "src/lib/auth/super-admin.ts": { lines: 90, functions: 90, branches: 80, statements: 90 },
    "src/lib/query/client.ts": { lines: 80, functions: 90, branches: 70, statements: 80 },
    "src/lib/domain/media-cleanup.ts": { lines: 90, functions: 90, branches: 75, statements: 85 },
    "src/lib/domain/organization-photo-retention.ts": { lines: 90, functions: 90, branches: 65, statements: 85 },
    "src/lib/domain/organization-workflow.ts": { lines: 65, functions: 70, branches: 50, statements: 65 },
    "src/lib/env.ts": { lines: 45, functions: 40, branches: 35, statements: 45 },
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
