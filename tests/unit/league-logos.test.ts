import { describe, expect, it } from "vitest";

import {
  buildLeagueLogoPlaceholderSvg,
  getLeagueLogoObjectPath,
  getLeagueLogoUrl,
  isSupportedLeagueLogoFile
} from "@/lib/league-logos";

function buildFile(name: string, type: string) {
  return new File(["image"], name, { type });
}

describe("league logo helpers", () => {
  it("acepta formatos compatibles para logos de liga", () => {
    expect(isSupportedLeagueLogoFile(buildFile("liga.jpg", "image/jpeg"))).toBe(true);
    expect(isSupportedLeagueLogoFile(buildFile("liga.png", "image/png"))).toBe(true);
    expect(isSupportedLeagueLogoFile(buildFile("liga.webp", "image/webp"))).toBe(true);
    expect(isSupportedLeagueLogoFile(buildFile("liga.svg", "image/svg+xml"))).toBe(true);
    expect(isSupportedLeagueLogoFile(buildFile("liga.gif", "image/gif"))).toBe(false);
  });

  it("arma path y url estables para storage y API", () => {
    expect(getLeagueLogoObjectPath("app_prod", "league-123")).toBe(
      "app_prod/leagues/league-123.webp"
    );
    expect(getLeagueLogoUrl("league-123")).toBe("/api/league-logo/league-123");
  });

  it("escapa el nombre de la liga antes de interpolarlo en el svg", () => {
    const svg = buildLeagueLogoPlaceholderSvg(`Liga <Norte> & "Sur"`);

    expect(svg).toContain("aria-label=\"Liga &lt;Norte&gt; &amp; &quot;Sur&quot;\"");
    expect(svg).toContain("<svg");
    expect(svg).not.toContain(`Liga <Norte> & "Sur"`);
  });
});
