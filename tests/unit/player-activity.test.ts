import { describe, expect, it } from "vitest";
import { calculatePlayerActivity } from "@/lib/domain/player-activity";
import type { MatchWithTeams } from "@/lib/domain/stats";

const player = { id: "player", organization_id: "org", created_at: "2026-01-01T00:00:00Z" };
function match(day: number, played = false, overrides: Partial<MatchWithTeams["match"]> = {}): MatchWithTeams {
  return {
    match: { id: `match-${day}`, organization_id: "org", status: "finished", scheduled_at: `2026-01-${String(day).padStart(2, "0")}T20:00:00Z`, ...overrides } as MatchWithTeams["match"],
    result: { match_id: `match-${day}` } as NonNullable<MatchWithTeams["result"]>,
    teamAPlayerIds: played ? [player.id] : [], teamBPlayerIds: []
  };
}

describe("current player activity", () => {
  it("marks absence at five completed matches and resets it on return", () => {
    const matches = [match(1, true), ...[2, 3, 4, 5].map((day) => match(day))];
    expect(calculatePlayerActivity([player], matches).get(player.id)).toMatchObject({ isAbsent: false, matchesSinceLastPlayed: 4 });
    matches.push(match(6));
    expect(calculatePlayerActivity([player], matches).get(player.id)).toEqual({ isAbsent: true, matchesSinceLastPlayed: 5, lastPlayedAt: "2026-01-01T20:00:00Z", isInjured: false });
    matches.push(match(7, true));
    expect(calculatePlayerActivity([player], matches.reverse()).get(player.id)).toMatchObject({ isAbsent: false, matchesSinceLastPlayed: 0, lastPlayedAt: "2026-01-07T20:00:00Z" });
  });

  it("exempts injured players without losing their last participation", () => {
    const matches = [match(1, true), ...[2, 3, 4, 5, 6].map((day) => match(day))];
    expect(calculatePlayerActivity([{ ...player, is_injured: true }], matches).get(player.id)).toMatchObject({ isAbsent: false, isInjured: true, matchesSinceLastPlayed: 5 });
    expect(calculatePlayerActivity([{ ...player, is_injured: false }], matches).get(player.id)?.isAbsent).toBe(true);
  });

  it("never counts cancelled, unfinished, resultless, duplicate or foreign-group matches", () => {
    const invalid = match(9); invalid.result = null;
    const matches = [match(1, true), match(2), match(2), match(3, false, { status: "cancelled" }), match(4, false, { status: "confirmed" }), match(5, false, { status: "draft" }), match(6, false, { organization_id: "another" }), invalid, match(10, false, { scheduled_at: "invalid" })];
    expect(calculatePlayerActivity([player], matches).get(player.id)?.matchesSinceLastPlayed).toBe(1);
  });

  it("starts counting non-debutants at registration and accepts historical participation", () => {
    const recentPlayer = { ...player, created_at: "2026-01-05T00:00:00Z" };
    const matches = [1, 2, 3, 4, 5, 6].map((day) => match(day));
    expect(calculatePlayerActivity([recentPlayer], matches).get(player.id)).toMatchObject({ lastPlayedAt: null, matchesSinceLastPlayed: 2, isAbsent: false });
    matches[0].teamBPlayerIds = [player.id];
    expect(calculatePlayerActivity([recentPlayer], matches).get(player.id)).toMatchObject({ lastPlayedAt: "2026-01-01T20:00:00Z", matchesSinceLastPlayed: 5, isAbsent: true });
  });

  it("does not turn time without group matches into absences", () => {
    expect(calculatePlayerActivity([player], []).get(player.id)).toEqual({ lastPlayedAt: null, matchesSinceLastPlayed: 0, isAbsent: false, isInjured: false });
  });

  it("counts distinct matches at the same scheduled time with a stable order", () => {
    const played = match(1, true, { id: "a" });
    const later = match(1, false, { id: "b" });
    expect(calculatePlayerActivity([player], [played, later]).get(player.id)?.matchesSinceLastPlayed).toBe(1);
    expect(calculatePlayerActivity([player], [later, played]).get(player.id)?.matchesSinceLastPlayed).toBe(1);
  });

  it("compares registration UTC with the group's stored court time", () => {
    const registered = { ...player, created_at: "2026-01-01T23:00:00Z" }; // 20:00 Buenos Aires
    expect(calculatePlayerActivity([registered], [match(1, false, { scheduled_at: "2026-01-01T21:00:00Z" })]).get(player.id)?.matchesSinceLastPlayed).toBe(1);
  });
});
