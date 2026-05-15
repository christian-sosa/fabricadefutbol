import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { PRIMARY_PUBLIC_NAV_ITEMS, PUBLIC_NAV_ITEMS } from "@/lib/constants";

const root = process.cwd();

function readSource(...segments: string[]) {
  return readFileSync(path.join(root, ...segments), "utf8");
}

describe("public copy source", () => {
  it("no promociona Torneos en navegacion y footer publicos", () => {
    expect(PUBLIC_NAV_ITEMS.map((item) => item.href)).not.toContain("/tournaments");
    expect(PRIMARY_PUBLIC_NAV_ITEMS.map((item) => item.href)).not.toContain("/tournaments");

    const footerSource = readSource("src", "components", "layout", "site-footer.tsx");
    expect(footerSource).toContain("Ranking real para grupos");
    expect(footerSource).not.toContain("Ranking real para grupos y torneos");
  });

  it("mantiene paginas publicas comunes enfocadas en grupos", () => {
    const publicPages = [
      readSource("src", "app", "about", "page.tsx"),
      readSource("src", "app", "pricing", "page.tsx"),
      readSource("src", "app", "help", "page.tsx"),
      readSource("src", "app", "feedback", "page.tsx"),
      readSource("src", "app", "privacy", "page.tsx"),
      readSource("src", "app", "terms", "page.tsx")
    ].join("\n");

    expect(publicPages).not.toMatch(/\bTorneos\b/);
    expect(publicPages).not.toMatch(/\btorneos\b/);
    expect(publicPages).not.toMatch(/\bligas?\b/i);
    expect(publicPages).not.toMatch(/\bcompetencias?\b/i);
    expect(publicPages).not.toContain("PublicModuleToggle");
    expect(publicPages).not.toContain("tournamentPlan");
    expect(publicPages).not.toContain("TOURNAMENT_MONTHLY_PRICE_ARS");
  });
});
