import { describe, expect, it } from "vitest";

import { generateTournamentFixture, saveTournamentMatchSheet } from "@/lib/domain/tournament-workflow";
import { createFakeSupabase } from "../helpers/fake-supabase";

const TOURNAMENT_ID = "tournament-1";
const ADMIN_ID = "admin-1";

function buildTeams(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `team-${index + 1}`,
    tournament_id: TOURNAMENT_ID,
    name: `Equipo ${index + 1}`,
    short_name: `E${index + 1}`,
    slug: `equipo-${index + 1}`,
    display_order: index + 1
  }));
}

describe("tournament workflow", () => {
  it("genera fixture round robin para torneo con cantidad impar de equipos", async () => {
    const fake = createFakeSupabase({
      admins: [{ id: ADMIN_ID, display_name: "Admin Torneo" }],
      tournaments: [{ id: TOURNAMENT_ID, name: "Clausura", slug: "clausura", season_label: "2026", created_by: ADMIN_ID }],
      tournament_teams: buildTeams(5)
    });

    await generateTournamentFixture({
      supabase: fake.client as never,
      adminId: ADMIN_ID,
      tournamentId: TOURNAMENT_ID
    });

    const rounds = fake.table("tournament_rounds");
    const matches = fake.table("tournament_matches");
    const pairSet = new Set(matches.map((match) => [match.home_team_id, match.away_team_id].sort().join(":")));

    expect(rounds).toHaveLength(5);
    expect(matches).toHaveLength(10);
    expect(pairSet.size).toBe(10);
    expect(matches.every((match) => match.status === "draft")).toBe(true);
  });

  it("guarda acta con jugador registrado y nombre libre, y marca el partido como jugado", async () => {
    const fake = createFakeSupabase({
      admins: [{ id: ADMIN_ID, display_name: "Admin Torneo" }],
      tournaments: [{ id: TOURNAMENT_ID, name: "Clausura", slug: "clausura", season_label: "2026", created_by: ADMIN_ID }],
      tournament_teams: [
        { id: "team-home", tournament_id: TOURNAMENT_ID, name: "Locales", short_name: "LOC", slug: "locales", display_order: 1 },
        { id: "team-away", tournament_id: TOURNAMENT_ID, name: "Visitantes", short_name: "VIS", slug: "visitantes", display_order: 2 }
      ],
      tournament_matches: [
        {
          id: "match-1",
          tournament_id: TOURNAMENT_ID,
          round_id: null,
          home_team_id: "team-home",
          away_team_id: "team-away",
          scheduled_at: "2026-04-25T20:00:00.000Z",
          venue: "Cancha 1",
          status: "scheduled",
          created_by: ADMIN_ID
        }
      ],
      tournament_players: [
        { id: "player-home", tournament_id: TOURNAMENT_ID, team_id: "team-home", full_name: "Juan Home", shirt_number: 9 },
        { id: "player-away", tournament_id: TOURNAMENT_ID, team_id: "team-away", full_name: "Pedro Away", shirt_number: 1 }
      ]
    });

    await saveTournamentMatchSheet({
      supabase: fake.client as never,
      adminId: ADMIN_ID,
      tournamentId: TOURNAMENT_ID,
      matchId: "match-1",
      input: {
        homeScore: 2,
        awayScore: 1,
        notes: "Partido intenso",
        mvpEntryKey: "team-home:player-home",
        stats: [
          {
            entryKey: "team-home:player-home",
            teamId: "team-home",
            playerId: "player-home",
            playerName: "Juan Home",
            goals: 2,
            yellowCards: 1,
            redCards: 0
          },
          {
            entryKey: "team-away:free-1",
            teamId: "team-away",
            playerId: null,
            playerName: "Invitado Away",
            goals: 1,
            yellowCards: 0,
            redCards: 0
          }
        ]
      }
    });

    expect(fake.find("tournament_matches", (row) => row.id === "match-1")).toEqual(
      expect.objectContaining({
        status: "played"
      })
    );
    expect(fake.find("tournament_match_results", (row) => row.match_id === "match-1")).toEqual(
      expect.objectContaining({
        home_score: 2,
        away_score: 1,
        mvp_player_id: "player-home",
        mvp_player_name: "Juan Home",
        notes: "Partido intenso"
      })
    );
    expect(fake.table("tournament_match_player_stats")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          match_id: "match-1",
          team_id: "team-home",
          player_id: "player-home",
          goals: 2,
          is_mvp: true
        }),
        expect.objectContaining({
          match_id: "match-1",
          team_id: "team-away",
          player_id: null,
          player_name: "Invitado Away",
          goals: 1,
          is_mvp: false
        })
      ])
    );
  });

  it("rechaza actas con jugadores asignados a un equipo distinto a su plantel", async () => {
    const fake = createFakeSupabase({
      admins: [{ id: ADMIN_ID, display_name: "Admin Torneo" }],
      tournaments: [{ id: TOURNAMENT_ID, name: "Clausura", slug: "clausura", season_label: "2026", created_by: ADMIN_ID }],
      tournament_teams: [
        { id: "team-home", tournament_id: TOURNAMENT_ID, name: "Locales", short_name: "LOC", slug: "locales", display_order: 1 },
        { id: "team-away", tournament_id: TOURNAMENT_ID, name: "Visitantes", short_name: "VIS", slug: "visitantes", display_order: 2 }
      ],
      tournament_matches: [
        {
          id: "match-1",
          tournament_id: TOURNAMENT_ID,
          round_id: null,
          home_team_id: "team-home",
          away_team_id: "team-away",
          scheduled_at: null,
          venue: null,
          status: "scheduled",
          created_by: ADMIN_ID
        }
      ],
      tournament_players: [
        { id: "player-away", tournament_id: TOURNAMENT_ID, team_id: "team-away", full_name: "Pedro Away", shirt_number: 1 }
      ]
    });

    await expect(
      saveTournamentMatchSheet({
        supabase: fake.client as never,
        adminId: ADMIN_ID,
        tournamentId: TOURNAMENT_ID,
        matchId: "match-1",
        input: {
          homeScore: 1,
          awayScore: 0,
          notes: "",
          mvpEntryKey: "team-home:player-away",
          stats: [
            {
              entryKey: "team-home:player-away",
              teamId: "team-home",
              playerId: "player-away",
              playerName: "Pedro Away",
              goals: 1,
              yellowCards: 0,
              redCards: 0
            }
          ]
        }
      })
    ).rejects.toThrow("equipo distinto");
  });
});
