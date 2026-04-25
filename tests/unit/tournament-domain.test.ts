import { describe, expect, it } from "vitest";

import { generateKnockoutStage, generateRoundRobinFixture } from "@/lib/domain/tournament-fixture";
import {
  buildTournamentBestDefense,
  buildTournamentStandings,
  type TournamentMatchReference,
  type TournamentMatchResultReference
} from "@/lib/domain/tournament-stats";

function buildTeams(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `team-${index + 1}`,
    name: `Equipo ${index + 1}`,
    short_name: `E${index + 1}`,
    display_order: index + 1
  }));
}

describe("tournament round robin fixture", () => {
  it("genera todos los cruces una sola vez con cantidad par", () => {
    const teams = buildTeams(4);
    const rounds = generateRoundRobinFixture(teams);

    const uniquePairs = new Set(
      rounds.flatMap((round) =>
        round.matches.map((match) => [match.homeTeamId, match.awayTeamId].sort().join(":"))
      )
    );

    expect(rounds).toHaveLength(3);
    expect(rounds.every((round) => round.matches.length === 2)).toBe(true);
    expect(uniquePairs).toEqual(
      new Set(["team-1:team-2", "team-1:team-3", "team-1:team-4", "team-2:team-3", "team-2:team-4", "team-3:team-4"])
    );
  });

  it("soporta cantidad impar sin guardar equipo fantasma", () => {
    const teams = buildTeams(5);
    const rounds = generateRoundRobinFixture(teams);
    const pairCounts = new Map<string, number>();
    const matchesByTeam = new Map<string, number>(teams.map((team) => [team.id, 0]));
    const byeCounts = new Map<string, number>(teams.map((team) => [team.id, 0]));

    for (const round of rounds) {
      for (const match of round.matches) {
        const pairKey = [match.homeTeamId, match.awayTeamId].sort().join(":");
        pairCounts.set(pairKey, (pairCounts.get(pairKey) ?? 0) + 1);
        matchesByTeam.set(match.homeTeamId, (matchesByTeam.get(match.homeTeamId) ?? 0) + 1);
        matchesByTeam.set(match.awayTeamId, (matchesByTeam.get(match.awayTeamId) ?? 0) + 1);
      }
      for (const bye of round.byes) {
        byeCounts.set(bye.teamId, (byeCounts.get(bye.teamId) ?? 0) + 1);
      }
    }

    expect(rounds).toHaveLength(5);
    expect(pairCounts.size).toBe(10);
    expect([...pairCounts.values()].every((count) => count === 1)).toBe(true);
    expect([...matchesByTeam.values()].every((count) => count === 4)).toBe(true);
    expect([...byeCounts.values()].every((count) => count === 1)).toBe(true);
  });

  it("genera byes reales en una llave de copa cuando faltan equipos", () => {
    const teams = buildTeams(6);
    const round = generateKnockoutStage(teams, { phase: "cup", roundNumber: 1 });

    expect(round.matches).toHaveLength(2);
    expect(round.byes).toHaveLength(2);
    expect(round.byes.every((bye) => bye.kind === "advance")).toBe(true);
  });
});

describe("tournament standings", () => {
  it("ordena por puntos, diferencia de gol, goles a favor y nombre", () => {
    const teams = buildTeams(4);
    const matches: TournamentMatchReference[] = [
      {
        id: "match-1",
        round_id: "round-1",
        home_team_id: "team-1",
        away_team_id: "team-3",
        phase: "league",
        stage_label: "Fecha 1",
        scheduled_at: null,
        venue: null,
        status: "played"
      },
      {
        id: "match-2",
        round_id: "round-1",
        home_team_id: "team-2",
        away_team_id: "team-3",
        phase: "league",
        stage_label: "Fecha 1",
        scheduled_at: null,
        venue: null,
        status: "played"
      },
      {
        id: "match-3",
        round_id: "round-2",
        home_team_id: "team-4",
        away_team_id: "team-1",
        phase: "league",
        stage_label: "Fecha 2",
        scheduled_at: null,
        venue: null,
        status: "played"
      },
      {
        id: "match-4",
        round_id: "round-2",
        home_team_id: "team-4",
        away_team_id: "team-2",
        phase: "league",
        stage_label: "Fecha 2",
        scheduled_at: null,
        venue: null,
        status: "played"
      }
    ];
    const results: TournamentMatchResultReference[] = [
      { match_id: "match-1", home_score: 1, away_score: 0, penalty_home_score: null, penalty_away_score: null, winner_team_id: "team-1", mvp_player_id: null, mvp_player_name: "Uno", notes: null },
      { match_id: "match-2", home_score: 2, away_score: 1, penalty_home_score: null, penalty_away_score: null, winner_team_id: "team-2", mvp_player_id: null, mvp_player_name: "Dos", notes: null },
      { match_id: "match-3", home_score: 0, away_score: 0, penalty_home_score: null, penalty_away_score: null, winner_team_id: null, mvp_player_id: null, mvp_player_name: "Tres", notes: null },
      { match_id: "match-4", home_score: 0, away_score: 0, penalty_home_score: null, penalty_away_score: null, winner_team_id: null, mvp_player_id: null, mvp_player_name: "Cuatro", notes: null }
    ];

    const standings = buildTournamentStandings({ teams, matches, results });
    const bestDefense = buildTournamentBestDefense({ teams, matches, results });

    expect(standings.map((row) => row.teamId)).toEqual(["team-2", "team-1", "team-4", "team-3"]);
    expect(standings[0]).toEqual(
      expect.objectContaining({
        teamId: "team-2",
        points: 4,
        goalDifference: 1,
        goalsFor: 2
      })
    );
    expect(standings[1]).toEqual(
      expect.objectContaining({
        teamId: "team-1",
        points: 4,
        goalDifference: 1,
        goalsFor: 1
      })
    );
    expect(bestDefense.slice(0, 2)).toEqual([
      expect.objectContaining({
        teamId: "team-1",
        goalsAgainst: 0,
        matchesPlayed: 2
      }),
      expect.objectContaining({
        teamId: "team-4",
        goalsAgainst: 0,
        matchesPlayed: 2
      })
    ]);
  });
});
