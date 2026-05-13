import { describe, expect, it } from "vitest";

import {
  getLeaguePhotoObjectPath,
  getLeaguePhotoUrl,
  isSupportedLeaguePhotoFile
} from "@/lib/league-photos";
import { getClubPlayerPhotoObjectPath } from "@/lib/player-photos";
import {
  getClubTeamLogoObjectPath,
  getClubTeamLogoUrl,
  getTeamLogoObjectPath,
  getTeamLogoUrl,
  isSupportedTeamLogoFile
} from "@/lib/team-logos";

function buildFile(name: string, type: string) {
  return new File(["image"], name, { type });
}

describe("tournament media helpers", () => {
  it("acepta formatos compatibles para fotos publicas de liga", () => {
    expect(isSupportedLeaguePhotoFile(buildFile("liga.jpg", "image/jpeg"))).toBe(true);
    expect(isSupportedLeaguePhotoFile(buildFile("liga.png", "image/png"))).toBe(true);
    expect(isSupportedLeaguePhotoFile(buildFile("liga.webp", "image/webp"))).toBe(true);
    expect(isSupportedLeaguePhotoFile(buildFile("liga.gif", "image/gif"))).toBe(false);
  });

  it("acepta formatos raster compatibles para logos de equipos y rechaza SVG", () => {
    expect(isSupportedTeamLogoFile(buildFile("escudo.png", "image/png"))).toBe(true);
    expect(isSupportedTeamLogoFile(buildFile("escudo.webp", "image/webp"))).toBe(true);
    expect(isSupportedTeamLogoFile(buildFile("escudo.svg", "image/svg+xml"))).toBe(false);
    expect(isSupportedTeamLogoFile(buildFile("escudo.svg", "image/png"))).toBe(false);
    expect(isSupportedTeamLogoFile(buildFile("escudo.gif", "image/gif"))).toBe(false);
  });

  it("arma paths y urls estables para fotos de liga y logos de equipo", () => {
    expect(getLeaguePhotoObjectPath("app_dev", "league-123")).toBe("app_dev/leagues/league-123.webp");
    expect(getLeaguePhotoUrl("league-123")).toBe("/api/league-photo/league-123");
    expect(getTeamLogoObjectPath("app_dev", "team-456")).toBe("app_dev/league-teams/team-456.webp");
    expect(getTeamLogoUrl("team-456")).toBe("/api/league-team-logo/team-456");
    expect(getClubPlayerPhotoObjectPath("app_dev", "club-1", "player-1")).toBe("app_dev/clubs/club-1/players/player-1.webp");
    expect(getClubTeamLogoObjectPath("app_dev", "club-team-1")).toBe("app_dev/club-teams/club-team-1.webp");
    expect(getClubTeamLogoUrl("club-team-1")).toBe("/api/club-team-logo/club-team-1");
  });
});
