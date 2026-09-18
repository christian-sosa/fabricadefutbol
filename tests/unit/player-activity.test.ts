import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calculatePlayerActivity, isPlayerAbsent } from "@/lib/domain/player-activity";
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
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-12T12:00:00Z"));
  });

  afterEach(() => vi.useRealTimers());

  it("marks absence at eight completed matches and resets it on return", () => {
    const matches = [match(1, true), ...[2, 3, 4, 5, 6, 7, 8].map((day) => match(day))];
    expect(calculatePlayerActivity([player], matches).get(player.id)).toMatchObject({ isAbsent: false, matchesSinceLastPlayed: 7 });
    matches.push(match(9));
    expect(calculatePlayerActivity([player], matches).get(player.id)).toEqual({ isAbsent: true, matchesSinceLastPlayed: 8, lastPlayedAt: "2026-01-01T20:00:00Z", isInjured: false });
    matches.push(match(10, true));
    expect(calculatePlayerActivity([player], matches.reverse()).get(player.id)).toMatchObject({ isAbsent: false, matchesSinceLastPlayed: 0, lastPlayedAt: "2026-01-10T20:00:00Z" });
  });

  it("exempts injured players without losing their last participation", () => {
    const matches = [match(1, true), ...[2, 3, 4, 5, 6, 7, 8, 9].map((day) => match(day))];
    expect(calculatePlayerActivity([{ ...player, is_injured: true }], matches).get(player.id)).toMatchObject({ isAbsent: false, isInjured: true, matchesSinceLastPlayed: 8 });
    expect(calculatePlayerActivity([{ ...player, is_injured: false }], matches).get(player.id)?.isAbsent).toBe(true);
    expect(calculatePlayerActivity([{ ...player, is_injured: true }], [match(1, true)], new Date("2026-03-01T12:00:00Z")).get(player.id))
      .toMatchObject({ isAbsent: false, isInjured: true, lastPlayedAt: "2026-01-01T20:00:00Z" });
  });

  it("never counts cancelled, unfinished, resultless, duplicate or foreign-group matches", () => {
    const invalid = match(9); invalid.result = null;
    const matches = [match(1, true), match(2), match(2), match(3, false, { status: "cancelled" }), match(4, false, { status: "confirmed" }), match(5, false, { status: "draft" }), match(6, false, { organization_id: "another" }), invalid, match(10, false, { scheduled_at: "invalid" })];
    expect(calculatePlayerActivity([player], matches).get(player.id)?.matchesSinceLastPlayed).toBe(1);
  });

  it("starts counting non-debutants at registration and accepts historical participation", () => {
    const recentPlayer = { ...player, created_at: "2026-01-05T00:00:00Z" };
    const matches = [1, 2, 3, 4, 5, 6].map((day) => match(day));
    expect(calculatePlayerActivity([recentPlayer], matches).get(player.id)).toMatchObject({ lastPlayedAt: null, matchesSinceLastPlayed: 2, isAbsent: true });
    matches[0].teamBPlayerIds = [player.id];
    expect(calculatePlayerActivity([recentPlayer], matches).get(player.id)).toMatchObject({ lastPlayedAt: "2026-01-01T20:00:00Z", matchesSinceLastPlayed: 5, isAbsent: false });
  });

  it("marks a player inactive immediately until their first completed match", () => {
    const newPlayer = { ...player, created_at: new Date().toISOString() };
    expect(calculatePlayerActivity([newPlayer], []).get(player.id)).toEqual({ lastPlayedAt: null, matchesSinceLastPlayed: 0, isAbsent: true, isInjured: false });
    expect(calculatePlayerActivity([newPlayer], [match(12, true, { status: "confirmed" })]).get(player.id)?.isAbsent).toBe(true);
    expect(calculatePlayerActivity([newPlayer], [match(12, true)]).get(player.id)).toMatchObject({ isAbsent: false, lastPlayedAt: "2026-01-12T20:00:00Z" });
  });

  it("keeps injured players without a debut exempt from inactivity", () => {
    expect(calculatePlayerActivity([{ ...player, is_injured: true }], []).get(player.id))
      .toEqual({ lastPlayedAt: null, matchesSinceLastPlayed: 0, isAbsent: false, isInjured: true });
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

  it("counts a month from the player's own last match even without newer group matches", () => {
    expect(calculatePlayerActivity([player], [match(1, true)], new Date("2026-02-01T03:00:00Z")).get(player.id))
      .toMatchObject({ isAbsent: true, matchesSinceLastPlayed: 0, lastPlayedAt: "2026-01-01T20:00:00Z" });
  });

  it.each([
    ["2026-08-18T01:00:00Z", "2026-09-18T03:00:00Z"],
    ["2026-01-31T20:00:00Z", "2026-02-28T03:00:00Z"],
    ["2028-01-31T20:00:00Z", "2028-02-29T03:00:00Z"],
    ["2026-08-31T20:00:00Z", "2026-09-30T03:00:00Z"],
    ["2026-12-31T20:00:00Z", "2027-01-31T03:00:00Z"]
  ])("reaches one calendar month from %s at midnight Buenos Aires %s", (lastPlayedAt, threshold) => {
    const activity = { isInjured: false, matchesSinceLastPlayed: 0, lastPlayedAt };
    expect(isPlayerAbsent(activity, new Date(Date.parse(threshold) - 1))).toBe(false);
    expect(isPlayerAbsent(activity, new Date(threshold))).toBe(true);
  });

  it("does not infer calendar inactivity from invalid or future dates", () => {
    for (const lastPlayedAt of ["invalid", "2027-01-01T20:00:00Z"]) {
      expect(isPlayerAbsent({ isInjured: false, matchesSinceLastPlayed: 7, lastPlayedAt })).toBe(false);
    }
    expect(isPlayerAbsent({ isInjured: false, matchesSinceLastPlayed: 8, lastPlayedAt: null })).toBe(true);
  });
});
