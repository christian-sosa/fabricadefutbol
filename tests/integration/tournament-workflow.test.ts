import { describe, expect, it } from "vitest";

import {
  generateCompetitionCupPlayoff,
  generateCompetitionFixture,
  saveCompetitionMatchSheet
} from "@/lib/domain/tournament-workflow";
import { createFakeSupabase } from "../helpers/fake-supabase";

const LEAGUE_ID = "league-1";
const COMPETITION_ID = "competition-1";
const ADMIN_ID = "admin-1";

function buildCompetitionTeams(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `competition-team-${index + 1}`,
    competition_id: COMPETITION_ID,
    league_team_id: `league-team-${index + 1}`,
    display_name: `Equipo ${index + 1}`,
    short_name: `E${index + 1}`,
    display_order: index + 1
  }));
}

describe("competition workflow", () => {
  it("genera fixture round robin para competencia con cantidad impar de equipos y guarda fechas libres", async () => {
    const fake = createFakeSupabase({
      admins: [{ id: ADMIN_ID, display_name: "Admin Liga" }],
      leagues: [{ id: LEAGUE_ID, name: "LAFAB", slug: "lafab", created_by: ADMIN_ID }],
      competitions: [
        {
          id: COMPETITION_ID,
          league_id: LEAGUE_ID,
          name: "Viernes A",
          slug: "viernes-a",
          season_label: "2026",
          type: "league",
          created_by: ADMIN_ID
        }
      ],
      competition_teams: buildCompetitionTeams(5)
    });

    await generateCompetitionFixture({
      supabase: fake.client as never,
      adminId: ADMIN_ID,
      competitionId: COMPETITION_ID
    });

    const rounds = fake.table("competition_rounds");
    const matches = fake.table("competition_matches");
    const byes = fake.table("competition_byes");
    const pairSet = new Set(
      matches.map((match) => [match.home_team_id, match.away_team_id].sort().join(":"))
    );

    expect(rounds).toHaveLength(5);
    expect(matches).toHaveLength(10);
    expect(byes).toHaveLength(5);
    expect(pairSet.size).toBe(10);
    expect(byes.every((bye) => bye.kind === "free_round")).toBe(true);
    expect(new Set(byes.map((bye) => bye.competition_team_id)).size).toBe(5);
  });

  it("genera cruces de copa con avances automaticos cuando faltan equipos", async () => {
    const fake = createFakeSupabase({
      admins: [{ id: ADMIN_ID, display_name: "Admin Liga" }],
      leagues: [{ id: LEAGUE_ID, name: "LAFAB", slug: "lafab", created_by: ADMIN_ID }],
      competitions: [
        {
          id: COMPETITION_ID,
          league_id: LEAGUE_ID,
          name: "Copa Viernes",
          slug: "copa-viernes",
          season_label: "2026",
          type: "cup",
          created_by: ADMIN_ID
        }
      ],
      competition_teams: buildCompetitionTeams(6)
    });

    await generateCompetitionFixture({
      supabase: fake.client as never,
      adminId: ADMIN_ID,
      competitionId: COMPETITION_ID
    });

    const rounds = fake.table("competition_rounds");
    const matches = fake.table("competition_matches");
    const byes = fake.table("competition_byes");

    expect(rounds).toHaveLength(1);
    expect(rounds[0]).toEqual(expect.objectContaining({ phase: "cup", stage_label: "Cuartos" }));
    expect(matches).toHaveLength(2);
    expect(byes).toHaveLength(2);
    expect(byes.every((bye) => bye.kind === "advance")).toBe(true);
  });

  it("permite cerrar un partido solo con marcador y notas, sin figura ni estadisticas", async () => {
    const fake = createFakeSupabase({
      admins: [{ id: ADMIN_ID, display_name: "Admin Liga" }],
      leagues: [{ id: LEAGUE_ID, name: "LAFAB", slug: "lafab", created_by: ADMIN_ID }],
      competitions: [
        {
          id: COMPETITION_ID,
          league_id: LEAGUE_ID,
          name: "Viernes A",
          slug: "viernes-a",
          season_label: "2026",
          type: "league",
          created_by: ADMIN_ID
        }
      ],
      competition_teams: [
        {
          id: "team-home",
          competition_id: COMPETITION_ID,
          league_team_id: "league-team-home",
          display_name: "Locales",
          short_name: "LOC",
          display_order: 1
        },
        {
          id: "team-away",
          competition_id: COMPETITION_ID,
          league_team_id: "league-team-away",
          display_name: "Visitantes",
          short_name: "VIS",
          display_order: 2
        }
      ],
      competition_matches: [
        {
          id: "match-1",
          competition_id: COMPETITION_ID,
          round_id: null,
          home_team_id: "team-home",
          away_team_id: "team-away",
          phase: "league",
          stage_label: "Fecha 1",
          scheduled_at: "2026-04-25T20:00:00.000Z",
          venue: "Cancha 1",
          status: "scheduled",
          created_by: ADMIN_ID
        }
      ]
    });

    await saveCompetitionMatchSheet({
      supabase: fake.client as never,
      adminId: ADMIN_ID,
      competitionId: COMPETITION_ID,
      matchId: "match-1",
      input: {
        homeScore: 1,
        awayScore: 0,
        notes: "Se jugo sin carga detallada",
        mvpEntryKey: null,
        stats: []
      }
    });

    expect(fake.find("competition_matches", (row) => row.id === "match-1")).toEqual(
      expect.objectContaining({
        status: "played"
      })
    );
    expect(fake.find("competition_match_results", (row) => row.match_id === "match-1")).toEqual(
      expect.objectContaining({
        home_score: 1,
        away_score: 0,
        mvp_player_id: null,
        mvp_player_name: null,
        notes: "Se jugo sin carga detallada"
      })
    );
    expect(fake.table("competition_match_player_stats")).toEqual([]);
  });

  it("guarda acta con jugador registrado y nombre libre en la misma competencia", async () => {
    const fake = createFakeSupabase({
      admins: [{ id: ADMIN_ID, display_name: "Admin Liga" }],
      leagues: [{ id: LEAGUE_ID, name: "LAFAB", slug: "lafab", created_by: ADMIN_ID }],
      competitions: [
        {
          id: COMPETITION_ID,
          league_id: LEAGUE_ID,
          name: "Viernes A",
          slug: "viernes-a",
          season_label: "2026",
          type: "league",
          created_by: ADMIN_ID
        }
      ],
      competition_teams: [
        {
          id: "team-home",
          competition_id: COMPETITION_ID,
          league_team_id: "league-team-home",
          display_name: "Locales",
          short_name: "LOC",
          display_order: 1
        },
        {
          id: "team-away",
          competition_id: COMPETITION_ID,
          league_team_id: "league-team-away",
          display_name: "Visitantes",
          short_name: "VIS",
          display_order: 2
        }
      ],
      competition_matches: [
        {
          id: "match-1",
          competition_id: COMPETITION_ID,
          round_id: null,
          home_team_id: "team-home",
          away_team_id: "team-away",
          phase: "league",
          stage_label: "Fecha 1",
          scheduled_at: "2026-04-25T20:00:00.000Z",
          venue: "Cancha 1",
          status: "scheduled",
          created_by: ADMIN_ID
        }
      ],
      competition_team_players: [
        {
          id: "player-home",
          competition_team_id: "team-home",
          full_name: "Juan Home",
          shirt_number: 9
        }
      ]
    });

    await saveCompetitionMatchSheet({
      supabase: fake.client as never,
      adminId: ADMIN_ID,
      competitionId: COMPETITION_ID,
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

    expect(fake.find("competition_match_results", (row) => row.match_id === "match-1")).toEqual(
      expect.objectContaining({
        home_score: 2,
        away_score: 1,
        mvp_player_id: "player-home",
        mvp_player_name: "Juan Home"
      })
    );
    expect(fake.table("competition_match_player_stats")).toEqual(
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

  it("rechaza empates en cruces de copa si faltan penales", async () => {
    const fake = createFakeSupabase({
      admins: [{ id: ADMIN_ID, display_name: "Admin Liga" }],
      leagues: [{ id: LEAGUE_ID, name: "LAFAB", slug: "lafab", created_by: ADMIN_ID }],
      competitions: [
        {
          id: COMPETITION_ID,
          league_id: LEAGUE_ID,
          name: "Copa Viernes",
          slug: "copa-viernes",
          season_label: "2026",
          type: "cup",
          created_by: ADMIN_ID
        }
      ],
      competition_teams: [
        { id: "team-home", competition_id: COMPETITION_ID, league_team_id: "league-team-home", display_name: "Locales", display_order: 1 },
        { id: "team-away", competition_id: COMPETITION_ID, league_team_id: "league-team-away", display_name: "Visitantes", display_order: 2 }
      ],
      competition_rounds: [
        { id: "round-1", competition_id: COMPETITION_ID, round_number: 1, name: "Final", phase: "cup", stage_label: "Final" }
      ],
      competition_matches: [
        {
          id: "match-1",
          competition_id: COMPETITION_ID,
          round_id: "round-1",
          home_team_id: "team-home",
          away_team_id: "team-away",
          phase: "cup",
          stage_label: "Final",
          scheduled_at: null,
          venue: null,
          status: "scheduled",
          created_by: ADMIN_ID
        }
      ]
    });

    await expect(
      saveCompetitionMatchSheet({
        supabase: fake.client as never,
        adminId: ADMIN_ID,
        competitionId: COMPETITION_ID,
        matchId: "match-1",
        input: {
          homeScore: 1,
          awayScore: 1,
          notes: "",
          mvpEntryKey: null,
          stats: []
        }
      })
    ).rejects.toThrow("penales");

    await saveCompetitionMatchSheet({
      supabase: fake.client as never,
      adminId: ADMIN_ID,
      competitionId: COMPETITION_ID,
      matchId: "match-1",
      input: {
        homeScore: 1,
        awayScore: 1,
        penaltyHomeScore: 4,
        penaltyAwayScore: 3,
        notes: "",
        mvpEntryKey: null,
        stats: []
      }
    });

    expect(fake.find("competition_match_results", (row) => row.match_id === "match-1")).toEqual(
      expect.objectContaining({
        penalty_home_score: 4,
        penalty_away_score: 3,
        winner_team_id: "team-home"
      })
    );
  });

  it("genera la siguiente ronda de copa automaticamente cuando se completa una etapa", async () => {
    const fake = createFakeSupabase({
      admins: [{ id: ADMIN_ID, display_name: "Admin Liga" }],
      leagues: [{ id: LEAGUE_ID, name: "LAFAB", slug: "lafab", created_by: ADMIN_ID }],
      competitions: [
        {
          id: COMPETITION_ID,
          league_id: LEAGUE_ID,
          name: "Copa Viernes",
          slug: "copa-viernes",
          season_label: "2026",
          type: "cup",
          created_by: ADMIN_ID
        }
      ],
      competition_teams: buildCompetitionTeams(4),
      competition_rounds: [
        { id: "round-1", competition_id: COMPETITION_ID, round_number: 1, name: "Semifinal", phase: "cup", stage_label: "Semifinal" }
      ],
      competition_matches: [
        {
          id: "match-1",
          competition_id: COMPETITION_ID,
          round_id: "round-1",
          home_team_id: "competition-team-1",
          away_team_id: "competition-team-4",
          phase: "cup",
          stage_label: "Semifinal",
          status: "scheduled",
          created_by: ADMIN_ID
        },
        {
          id: "match-2",
          competition_id: COMPETITION_ID,
          round_id: "round-1",
          home_team_id: "competition-team-2",
          away_team_id: "competition-team-3",
          phase: "cup",
          stage_label: "Semifinal",
          status: "scheduled",
          created_by: ADMIN_ID
        }
      ]
    });

    await saveCompetitionMatchSheet({
      supabase: fake.client as never,
      adminId: ADMIN_ID,
      competitionId: COMPETITION_ID,
      matchId: "match-1",
      input: {
        homeScore: 2,
        awayScore: 0,
        notes: "",
        mvpEntryKey: null,
        stats: []
      }
    });

    expect(fake.table("competition_rounds")).toHaveLength(1);

    await saveCompetitionMatchSheet({
      supabase: fake.client as never,
      adminId: ADMIN_ID,
      competitionId: COMPETITION_ID,
      matchId: "match-2",
      input: {
        homeScore: 1,
        awayScore: 0,
        notes: "",
        mvpEntryKey: null,
        stats: []
      }
    });

    expect(fake.table("competition_rounds")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ round_number: 2, phase: "cup", stage_label: "Final" })
      ])
    );
    expect(fake.table("competition_matches")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          phase: "cup",
          stage_label: "Final",
          home_team_id: "competition-team-1",
          away_team_id: "competition-team-2"
        })
      ])
    );
  });

  it("genera playoff de liga + copa cuando la fase liga ya termino", async () => {
    const fake = createFakeSupabase({
      admins: [{ id: ADMIN_ID, display_name: "Admin Liga" }],
      leagues: [{ id: LEAGUE_ID, name: "LAFAB", slug: "lafab", created_by: ADMIN_ID }],
      competitions: [
        {
          id: COMPETITION_ID,
          league_id: LEAGUE_ID,
          name: "Clausura",
          slug: "clausura",
          season_label: "2026",
          type: "league_and_cup",
          playoff_size: 4,
          created_by: ADMIN_ID
        }
      ],
      competition_teams: buildCompetitionTeams(4),
      competition_rounds: [
        { id: "round-1", competition_id: COMPETITION_ID, round_number: 1, name: "Fecha 1", phase: "league", stage_label: "Fecha 1" }
      ],
      competition_matches: [
        {
          id: "match-1",
          competition_id: COMPETITION_ID,
          round_id: "round-1",
          home_team_id: "competition-team-1",
          away_team_id: "competition-team-4",
          phase: "league",
          stage_label: "Fecha 1",
          status: "played",
          created_by: ADMIN_ID
        },
        {
          id: "match-2",
          competition_id: COMPETITION_ID,
          round_id: "round-1",
          home_team_id: "competition-team-2",
          away_team_id: "competition-team-3",
          phase: "league",
          stage_label: "Fecha 1",
          status: "played",
          created_by: ADMIN_ID
        }
      ],
      competition_match_results: [
        { match_id: "match-1", home_score: 3, away_score: 0 },
        { match_id: "match-2", home_score: 2, away_score: 1 }
      ]
    });

    await generateCompetitionCupPlayoff({
      supabase: fake.client as never,
      adminId: ADMIN_ID,
      competitionId: COMPETITION_ID
    });

    expect(fake.table("competition_rounds")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ phase: "cup", stage_label: "Semifinal" })
      ])
    );
    expect(
      fake.table("competition_matches").filter((match) => match.phase === "cup")
    ).toHaveLength(2);
  });

  it("rechaza actas con jugadores asignados a un equipo distinto a su plantel", async () => {
    const fake = createFakeSupabase({
      admins: [{ id: ADMIN_ID, display_name: "Admin Liga" }],
      leagues: [{ id: LEAGUE_ID, name: "LAFAB", slug: "lafab", created_by: ADMIN_ID }],
      competitions: [
        {
          id: COMPETITION_ID,
          league_id: LEAGUE_ID,
          name: "Viernes A",
          slug: "viernes-a",
          season_label: "2026",
          type: "league",
          created_by: ADMIN_ID
        }
      ],
      competition_teams: [
        {
          id: "team-home",
          competition_id: COMPETITION_ID,
          league_team_id: "league-team-home",
          display_name: "Locales",
          short_name: "LOC",
          display_order: 1
        },
        {
          id: "team-away",
          competition_id: COMPETITION_ID,
          league_team_id: "league-team-away",
          display_name: "Visitantes",
          short_name: "VIS",
          display_order: 2
        }
      ],
      competition_matches: [
        {
          id: "match-1",
          competition_id: COMPETITION_ID,
          round_id: null,
          home_team_id: "team-home",
          away_team_id: "team-away",
          phase: "league",
          stage_label: "Fecha 1",
          scheduled_at: null,
          venue: null,
          status: "scheduled",
          created_by: ADMIN_ID
        }
      ],
      competition_team_players: [
        {
          id: "player-away",
          competition_team_id: "team-away",
          full_name: "Pedro Away",
          shirt_number: 1
        }
      ]
    });

    await expect(
      saveCompetitionMatchSheet({
        supabase: fake.client as never,
        adminId: ADMIN_ID,
        competitionId: COMPETITION_ID,
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
