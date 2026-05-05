import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createSupabaseServerClientMock, noStoreMock, unstableCacheMock } = vi.hoisted(() => ({
  createSupabaseServerClientMock: vi.fn(),
  noStoreMock: vi.fn(),
  unstableCacheMock: vi.fn((fn: unknown) => fn)
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock
}));

vi.mock("next/cache", () => ({
  unstable_noStore: noStoreMock,
  unstable_cache: unstableCacheMock,
  revalidatePath: vi.fn()
}));

import {
  getPublicCompetitionBySlugs,
  getPublicCompetitionMatchDetails,
  getPublicLeagueBySlug,
  getPublicLeagues
} from "@/lib/queries/tournaments";
import { createFakeSupabase } from "../helpers/fake-supabase";

describe("league and competition public queries", () => {
  beforeEach(() => {
    createSupabaseServerClientMock.mockReset();
    noStoreMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("configura cache revalidable para consultas publicas de torneos", () => {
    expect(unstableCacheMock).toHaveBeenCalledWith(
      expect.any(Function),
      ["public-tournaments:leagues"],
      expect.objectContaining({
        revalidate: 300,
        tags: ["public-tournaments"]
      })
    );
    expect(unstableCacheMock).toHaveBeenCalledWith(
      expect.any(Function),
      ["public-tournaments:league"],
      expect.objectContaining({
        revalidate: 300,
        tags: ["public-tournaments"]
      })
    );
    expect(unstableCacheMock).toHaveBeenCalledWith(
      expect.any(Function),
      ["public-tournaments:competition"],
      expect.objectContaining({
        revalidate: 300,
        tags: ["public-tournaments"]
      })
    );
  });

  it("lista solo ligas activas o finalizadas con sus cantidades", async () => {
    const fake = createFakeSupabase({
      leagues: [
        {
          id: "league-1",
          name: "LAFAB",
          slug: "lafab",
          venue_name: "Parque Norte",
          is_public: true,
          status: "active",
          created_by: "admin-1",
          created_at: "2026-04-20T00:00:00.000Z"
        },
        {
          id: "league-2",
          name: "Privada",
          slug: "privada",
          is_public: true,
          status: "draft",
          created_by: "admin-1",
          created_at: "2026-04-21T00:00:00.000Z"
        }
      ],
      league_teams: [
        { id: "league-team-1", league_id: "league-1", name: "Alfa", slug: "alfa" },
        { id: "league-team-2", league_id: "league-1", name: "Beta", slug: "beta" },
        { id: "league-team-3", league_id: "league-2", name: "Gamma", slug: "gamma" }
      ],
      competitions: [
        {
          id: "competition-1",
          league_id: "league-1",
          name: "Viernes A",
          slug: "viernes-a",
          season_label: "2026",
          is_public: true,
          status: "active"
        },
        {
          id: "competition-2",
          league_id: "league-2",
          name: "Sabado",
          slug: "sabado",
          season_label: "2026",
          is_public: true,
          status: "active"
        }
      ]
    });

    createSupabaseServerClientMock.mockResolvedValue(fake.client);

    await expect(getPublicLeagues()).resolves.toEqual([
      expect.objectContaining({
        id: "league-1",
        slug: "lafab",
        logoUrl: "/api/league-logo/league-1",
        venueName: "Parque Norte",
        teamCount: 2,
        competitionCount: 1,
        status: "active"
      })
    ]);
  });

  it("lista todas las ligas activas porque Torneos no tiene modo no listado", async () => {
    const fake = createFakeSupabase({
      leagues: [
        {
          id: "league-listed",
          name: "Liga Listada",
          slug: "liga-listada",
          is_public: true,
          status: "active",
          created_at: "2026-04-20T00:00:00.000Z"
        },
        {
          id: "league-client",
          name: "Liga Cliente",
          slug: "liga-cliente",
          is_public: true,
          status: "active",
          created_at: "2026-04-21T00:00:00.000Z"
        }
      ]
    });

    createSupabaseServerClientMock.mockResolvedValue(fake.client);

    await expect(getPublicLeagues()).resolves.toEqual([
      expect.objectContaining({
        id: "league-client"
      }),
      expect.objectContaining({
        id: "league-listed"
      })
    ]);

    await expect(getPublicLeagueBySlug("liga-cliente")).resolves.toEqual(
      expect.objectContaining({
        league: expect.objectContaining({
          id: "league-client"
        })
      })
    );
  });

  it("muestra el resumen publico de una liga con sede y competencias", async () => {
    const fake = createFakeSupabase({
      leagues: [
        {
          id: "league-1",
          name: "LAFAB",
          slug: "lafab",
          description: "Liga amateur de los viernes",
          photo_path: "app_dev/leagues/league-1.webp",
          venue_name: "Parque Norte",
          location_notes: "Canchas 1 y 2",
          is_public: true,
          status: "active"
        }
      ],
      league_teams: [
        { id: "league-team-1", league_id: "league-1", name: "Alfa", slug: "alfa", short_name: "ALF" },
        { id: "league-team-2", league_id: "league-1", name: "Beta", slug: "beta", short_name: "BET" }
      ],
      competitions: [
        {
          id: "competition-1",
          league_id: "league-1",
          name: "Viernes A",
          slug: "viernes-a",
          season_label: "2026",
          description: "Zona principal",
          is_public: true,
          status: "active",
          created_at: "2026-04-22T00:00:00.000Z"
        },
        {
          id: "competition-2",
          league_id: "league-1",
          name: "Viernes B",
          slug: "viernes-b",
          season_label: "2026",
          description: "Zona desarrollo",
          is_public: true,
          status: "draft",
          created_at: "2026-04-23T00:00:00.000Z"
        }
      ],
      competition_teams: [
        {
          id: "competition-team-1",
          competition_id: "competition-1",
          league_team_id: "league-team-1",
          display_name: "Alfa",
          short_name: "ALF",
          display_order: 1
        },
        {
          id: "competition-team-2",
          competition_id: "competition-1",
          league_team_id: "league-team-2",
          display_name: "Beta",
          short_name: "BET",
          display_order: 2
        }
      ]
    });

    createSupabaseServerClientMock.mockResolvedValue(fake.client);

    const data = await getPublicLeagueBySlug("lafab");

    expect(data).toEqual(
      expect.objectContaining({
        league: expect.objectContaining({
          slug: "lafab",
          logoUrl: "/api/league-logo/league-1",
          photoUrl: "/api/league-photo/league-1",
          venueName: "Parque Norte",
          locationNotes: "Canchas 1 y 2",
          teamCount: 2,
          competitionCount: 1
        }),
        competitions: [
          expect.objectContaining({
            slug: "viernes-a",
            teamCount: 2
          })
        ]
      })
    );
  });

  it("lista todas las competencias activas de una liga", async () => {
    const fake = createFakeSupabase({
      leagues: [
        {
          id: "league-1",
          name: "LAFAB",
          slug: "lafab",
          is_public: true,
          status: "active"
        }
      ],
      competitions: [
        {
          id: "competition-listed",
          league_id: "league-1",
          name: "Viernes A",
          slug: "viernes-a",
          season_label: "2026",
          is_public: true,
          status: "active"
        },
        {
          id: "competition-client",
          league_id: "league-1",
          name: "Copa Privada",
          slug: "copa-privada",
          season_label: "2026",
          is_public: true,
          status: "active"
        }
      ]
    });

    createSupabaseServerClientMock.mockResolvedValue(fake.client);

    await expect(getPublicLeagueBySlug("lafab")).resolves.toEqual(
      expect.objectContaining({
        competitions: [
          expect.objectContaining({
            id: "competition-listed"
          }),
          expect.objectContaining({
            id: "competition-client"
          })
        ]
      })
    );

    await expect(
      getPublicCompetitionBySlugs({
        leagueSlug: "lafab",
        competitionSlug: "copa-privada"
      })
    ).resolves.toEqual(
      expect.objectContaining({
        competition: expect.objectContaining({
          id: "competition-client"
        })
      })
    );
  });

  it("oculta competencias en borrador aun si estan marcadas como publicas", async () => {
    const fake = createFakeSupabase({
      leagues: [
        {
          id: "league-1",
          name: "LAFAB",
          slug: "lafab",
          is_public: true,
          status: "active"
        }
      ],
      competitions: [
        {
          id: "competition-1",
          league_id: "league-1",
          name: "Viernes B",
          slug: "viernes-b",
          season_label: "2026",
          is_public: true,
          status: "draft"
        }
      ]
    });

    createSupabaseServerClientMock.mockResolvedValue(fake.client);

    await expect(
      getPublicCompetitionBySlugs({
        leagueSlug: "lafab",
        competitionSlug: "viernes-b"
      })
    ).resolves.toBeNull();
  });

  it("no fuerza noStore en consultas publicas cacheables de torneos", async () => {
    const fake = createFakeSupabase({
      leagues: [
        {
          id: "league-1",
          name: "LAFAB",
          slug: "lafab",
          is_public: true,
          status: "active"
        }
      ]
    });

    createSupabaseServerClientMock.mockResolvedValue(fake.client);

    await getPublicLeagues();
    await getPublicLeagueBySlug("lafab");

    expect(noStoreMock).not.toHaveBeenCalled();
  });

  it("arma el detalle publico de una competencia con tabla, fixture y leaderboards", async () => {
    const fake = createFakeSupabase({
      leagues: [
        {
          id: "league-1",
          name: "LAFAB",
          slug: "lafab",
          is_public: true,
          status: "active"
        }
      ],
      league_teams: [
        { id: "league-team-a", league_id: "league-1", name: "Alfa", short_name: "ALF", slug: "alfa" },
        { id: "league-team-b", league_id: "league-1", name: "Beta", short_name: "BET", slug: "beta" }
      ],
      competitions: [
        {
          id: "competition-1",
          league_id: "league-1",
          name: "Viernes A",
          slug: "viernes-a",
          season_label: "2026",
          description: "Zona principal",
          type: "league",
          is_public: true,
          status: "active"
        }
      ],
      competition_teams: [
        {
          id: "competition-team-a",
          competition_id: "competition-1",
          league_team_id: "league-team-a",
          display_name: "Alfa",
          short_name: "ALF",
          display_order: 1
        },
        {
          id: "competition-team-b",
          competition_id: "competition-1",
          league_team_id: "league-team-b",
          display_name: "Beta",
          short_name: "BET",
          display_order: 2
        }
      ],
      competition_team_players: [
        { id: "player-a", competition_team_id: "competition-team-a", full_name: "Juan Alfa", shirt_number: 9 },
        { id: "player-b", competition_team_id: "competition-team-b", full_name: "Pedro Beta", shirt_number: 10 }
      ],
      competition_rounds: [
        { id: "round-1", competition_id: "competition-1", round_number: 1, name: "Fecha 1", phase: "league", stage_label: "Fecha 1" }
      ],
      competition_matches: [
        {
          id: "match-1",
          competition_id: "competition-1",
          round_id: "round-1",
          home_team_id: "competition-team-a",
          away_team_id: "competition-team-b",
          phase: "league",
          stage_label: "Fecha 1",
          scheduled_at: "2026-04-25T20:00:00.000Z",
          venue: "Cancha Central",
          status: "played",
          created_by: "admin-1"
        }
      ],
      competition_match_results: [
        {
          match_id: "match-1",
          home_score: 3,
          away_score: 1,
          mvp_player_id: "player-a",
          mvp_player_name: "Juan Alfa",
          notes: "Buen partido"
        }
      ],
      competition_match_player_stats: [
        {
          match_id: "match-1",
          team_id: "competition-team-a",
          player_id: "player-a",
          player_name: "Juan Alfa",
          goals: 3,
          yellow_cards: 0,
          red_cards: 0,
          is_mvp: true
        },
        {
          match_id: "match-1",
          team_id: "competition-team-b",
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

    const data = await getPublicCompetitionBySlugs({
      leagueSlug: "lafab",
      competitionSlug: "viernes-a"
    });

    expect(data).toEqual(
      expect.objectContaining({
        league: expect.objectContaining({
          slug: "lafab"
        }),
        competition: expect.objectContaining({
          slug: "viernes-a",
          seasonLabel: "2026"
        }),
        standings: [
          expect.objectContaining({
            teamId: "competition-team-a",
            points: 3,
            goalDifference: 2
          }),
          expect.objectContaining({
            teamId: "competition-team-b",
            points: 0
          })
        ],
        fixture: [
          expect.objectContaining({
            id: "match-1",
            kind: "match",
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
            teamId: "competition-team-a",
            goalsAgainst: 1
          }),
          expect.objectContaining({
            teamId: "competition-team-b",
            goalsAgainst: 3
          })
        ]
      })
    );
  });

  it("devuelve el detalle publico de un partido con stats separados por equipo", async () => {
    const fake = createFakeSupabase({
      leagues: [
        {
          id: "league-1",
          name: "LAFAB",
          slug: "lafab",
          is_public: true,
          status: "active"
        }
      ],
      league_teams: [
        { id: "league-team-a", league_id: "league-1", name: "Alfa", short_name: "ALF", slug: "alfa" },
        { id: "league-team-b", league_id: "league-1", name: "Beta", short_name: "BET", slug: "beta" }
      ],
      competitions: [
        {
          id: "competition-1",
          league_id: "league-1",
          name: "Viernes A",
          slug: "viernes-a",
          season_label: "2026",
          type: "league",
          is_public: true,
          status: "active"
        }
      ],
      competition_teams: [
        {
          id: "competition-team-a",
          competition_id: "competition-1",
          league_team_id: "league-team-a",
          display_name: "Alfa",
          short_name: "ALF",
          display_order: 1
        },
        {
          id: "competition-team-b",
          competition_id: "competition-1",
          league_team_id: "league-team-b",
          display_name: "Beta",
          short_name: "BET",
          display_order: 2
        }
      ],
      competition_rounds: [
        { id: "round-1", competition_id: "competition-1", round_number: 1, name: "Fecha 1", phase: "league", stage_label: "Fecha 1" }
      ],
      competition_matches: [
        {
          id: "match-1",
          competition_id: "competition-1",
          round_id: "round-1",
          home_team_id: "competition-team-a",
          away_team_id: "competition-team-b",
          phase: "league",
          stage_label: "Fecha 1",
          scheduled_at: null,
          venue: null,
          status: "played",
          created_by: "admin-1"
        }
      ],
      competition_match_results: [
        {
          match_id: "match-1",
          home_score: 2,
          away_score: 1,
          mvp_player_id: null,
          mvp_player_name: null,
          notes: null
        }
      ],
      competition_match_player_stats: [
        {
          match_id: "match-1",
          team_id: "competition-team-a",
          player_id: null,
          player_name: "Invitado Alfa",
          goals: 2,
          yellow_cards: 0,
          red_cards: 0,
          is_mvp: true
        },
        {
          match_id: "match-1",
          team_id: "competition-team-b",
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

    const data = await getPublicCompetitionMatchDetails({
      leagueSlug: "lafab",
      competitionSlug: "viernes-a",
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
