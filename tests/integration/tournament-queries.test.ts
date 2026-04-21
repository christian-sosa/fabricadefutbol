import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createSupabaseServerClientMock, noStoreMock } = vi.hoisted(() => ({
  createSupabaseServerClientMock: vi.fn(),
  noStoreMock: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock
}));

vi.mock("next/cache", () => ({
  unstable_noStore: noStoreMock,
  revalidatePath: vi.fn()
}));

import { getPublicTournamentBySlug, getPublicTournamentMatchDetails, getPublicTournaments } from "@/lib/queries/tournaments";
import { createFakeSupabase } from "../helpers/fake-supabase";

describe("tournament public queries", () => {
  beforeEach(() => {
    createSupabaseServerClientMock.mockReset();
    noStoreMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("lista solo torneos publicos", async () => {
    const fake = createFakeSupabase({
      tournaments: [
        {
          id: "t-1",
          name: "Apertura",
          slug: "apertura",
          season_label: "2026",
          is_public: true,
          status: "active",
          created_by: "admin-1",
          created_at: "2026-04-20T00:00:00.000Z"
        },
        {
          id: "t-2",
          name: "Privado",
          slug: "privado",
          season_label: "2026",
          is_public: false,
          status: "draft",
          created_by: "admin-1",
          created_at: "2026-04-21T00:00:00.000Z"
        }
      ]
    });

    createSupabaseServerClientMock.mockResolvedValue(fake.client);

    await expect(getPublicTournaments()).resolves.toEqual([
      expect.objectContaining({
        id: "t-1",
        slug: "apertura",
        isPublic: true
      })
    ]);
  });

  it("arma detalle publico con tabla, fixture y leaderboards derivados", async () => {
    const fake = createFakeSupabase({
      tournaments: [
        {
          id: "t-1",
          name: "Apertura",
          slug: "apertura",
          season_label: "2026",
          description: "Liga simple",
          is_public: true,
          status: "active",
          created_by: "admin-1",
          created_at: "2026-04-20T00:00:00.000Z"
        }
      ],
      tournament_teams: [
        { id: "team-a", tournament_id: "t-1", name: "Alfa", short_name: "ALF", slug: "alfa", display_order: 1 },
        { id: "team-b", tournament_id: "t-1", name: "Beta", short_name: "BET", slug: "beta", display_order: 2 }
      ],
      tournament_players: [
        { id: "player-a", tournament_id: "t-1", team_id: "team-a", full_name: "Juan Alfa", shirt_number: 9 },
        { id: "player-b", tournament_id: "t-1", team_id: "team-b", full_name: "Pedro Beta", shirt_number: 10 }
      ],
      tournament_rounds: [{ id: "round-1", tournament_id: "t-1", round_number: 1, name: "Fecha 1" }],
      tournament_matches: [
        {
          id: "match-1",
          tournament_id: "t-1",
          round_id: "round-1",
          home_team_id: "team-a",
          away_team_id: "team-b",
          scheduled_at: "2026-04-25T20:00:00.000Z",
          venue: "Cancha Central",
          status: "played",
          created_by: "admin-1"
        }
      ],
      tournament_match_results: [
        {
          match_id: "match-1",
          home_score: 3,
          away_score: 1,
          mvp_player_id: "player-a",
          mvp_player_name: "Juan Alfa",
          notes: "Buen partido",
          created_by: "admin-1"
        }
      ],
      tournament_match_player_stats: [
        {
          match_id: "match-1",
          team_id: "team-a",
          player_id: "player-a",
          player_name: "Juan Alfa",
          goals: 3,
          yellow_cards: 0,
          red_cards: 0,
          is_mvp: true
        },
        {
          match_id: "match-1",
          team_id: "team-b",
          player_id: "player-b",
          player_name: "Pedro Beta",
          goals: 1,
          yellow_cards: 1,
          red_cards: 0,
          is_mvp: false
        }
      ]
    });

    createSupabaseServerClientMock.mockResolvedValue(fake.client);

    const data = await getPublicTournamentBySlug("apertura");

    expect(data).toEqual(
      expect.objectContaining({
        tournament: expect.objectContaining({
          slug: "apertura",
          seasonLabel: "2026"
        }),
        standings: [
          expect.objectContaining({
            teamId: "team-a",
            points: 3,
            goalDifference: 2
          }),
          expect.objectContaining({
            teamId: "team-b",
            points: 0
          })
        ],
        fixture: [
          expect.objectContaining({
            id: "match-1",
            roundName: "Fecha 1",
            homeScore: 3,
            awayScore: 1
          })
        ],
        topScorers: [
          expect.objectContaining({
            playerName: "Juan Alfa",
            goals: 3
          }),
          expect.objectContaining({
            playerName: "Pedro Beta",
            goals: 1
          })
        ],
        topFigures: [
          expect.objectContaining({
            playerName: "Juan Alfa",
            mvpCount: 1
          })
        ],
        bestDefense: [
          expect.objectContaining({
            teamId: "team-a",
            goalsAgainst: 1
          }),
          expect.objectContaining({
            teamId: "team-b",
            goalsAgainst: 3
          })
        ]
      })
    );
  });

  it("devuelve el detalle publico de un partido con stats separados por equipo", async () => {
    const fake = createFakeSupabase({
      tournaments: [
        {
          id: "t-1",
          name: "Apertura",
          slug: "apertura",
          season_label: "2026",
          is_public: true,
          status: "active",
          created_by: "admin-1"
        }
      ],
      tournament_teams: [
        { id: "team-a", tournament_id: "t-1", name: "Alfa", short_name: "ALF", slug: "alfa", display_order: 1 },
        { id: "team-b", tournament_id: "t-1", name: "Beta", short_name: "BET", slug: "beta", display_order: 2 }
      ],
      tournament_rounds: [{ id: "round-1", tournament_id: "t-1", round_number: 1, name: "Fecha 1" }],
      tournament_matches: [
        {
          id: "match-1",
          tournament_id: "t-1",
          round_id: "round-1",
          home_team_id: "team-a",
          away_team_id: "team-b",
          scheduled_at: null,
          venue: null,
          status: "played",
          created_by: "admin-1"
        }
      ],
      tournament_match_results: [
        {
          match_id: "match-1",
          home_score: 2,
          away_score: 1,
          mvp_player_id: null,
          mvp_player_name: "Invitado Alfa",
          notes: null,
          created_by: "admin-1"
        }
      ],
      tournament_match_player_stats: [
        {
          match_id: "match-1",
          team_id: "team-a",
          player_id: null,
          player_name: "Invitado Alfa",
          goals: 2,
          yellow_cards: 0,
          red_cards: 0,
          is_mvp: true
        },
        {
          match_id: "match-1",
          team_id: "team-b",
          player_id: null,
          player_name: "Invitado Beta",
          goals: 1,
          yellow_cards: 1,
          red_cards: 0,
          is_mvp: false
        }
      ]
    });

    createSupabaseServerClientMock.mockResolvedValue(fake.client);

    const data = await getPublicTournamentMatchDetails({
      slug: "apertura",
      matchId: "match-1"
    });

    expect(data).toEqual(
      expect.objectContaining({
        match: expect.objectContaining({
          id: "match-1",
          homeTeamName: "Alfa",
          awayTeamName: "Beta"
        }),
        homeStats: [
          expect.objectContaining({
            player_name: "Invitado Alfa",
            teamName: "Alfa",
            is_mvp: true
          })
        ],
        awayStats: [
          expect.objectContaining({
            player_name: "Invitado Beta",
            teamName: "Beta",
            yellow_cards: 1
          })
        ]
      })
    );
  });
});
