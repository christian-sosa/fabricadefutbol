import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off"
    }
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "brand-assets/**",
    "coverage/**",
    "docs/**",
    "output/**",
    "outputs/**",
    "playwright-report/**",
    "player-photo-import/**",
    "public/players/**",
    "supabase/**",
    "test-results/**",
    "tmp/**",
    "next-env.d.ts"
  ])
]);
