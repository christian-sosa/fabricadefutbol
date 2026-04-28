import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createSupabaseServerClientMock, cookiesMock, noStoreMock } = vi.hoisted(() => ({
  createSupabaseServerClientMock: vi.fn(),
  cookiesMock: vi.fn(),
  noStoreMock: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock
}));

vi.mock("next/cache", () => ({
  unstable_noStore: noStoreMock
}));

import { ACTIVE_ORG_COOKIE } from "@/lib/active-org";
import {
  getHomeSummary,
  getMatchDetails,
  getMatchHistoryCardsPage,
  getPlayerDetails,
  getPlayersWithStats,
  getUpcomingConfirmedMatches,
  getViewerAdminOrganizations,
  resolvePublicOrganization
} from "@/lib/queries/public";
import { createFakeSupabase } from "../helpers/fake-supabase";

const ORG_ID = "org-1";

function buildPlayers() {
  return [
    {
      id: "player-1",
      organization_id: ORG_ID,
      full_name: "Arquero",
      initial_rank: 1,
      current_rating: 1200,
      active: true
    },
    {
      id: "player-2",
      organization_id: ORG_ID,
      full_name: "Defensor",
      initial_rank: 2,
      current_rating: 1140,
      active: true
    },
    {
      id: "player-3",
      organization_id: ORG_ID,
      full_name: "Volante",
      initial_rank: 3,
      current_rating: 1090,
      active: true
    },
    {
      id: "player-4",
      organization_id: ORG_ID,
      full_name: "Delantero",
      initial_rank: 4,
      current_rating: 1040,
      active: true
    },
    {
      id: "player-5",
      organization_id: ORG_ID,
      full_name: "Suplente",
      initial_rank: 5,
      current_rating: 980,
      active: false
    }
  ];
}

function buildOrganizations() {
  return [
    { id: "org-1", name: "Liga A", slug: "liga-a", is_public: true, created_at: "2026-04-01T00:00:00.000Z" },
    { id: "org-2", name: "Liga B", slug: "liga-b", is_public: true, created_at: "2026-04-02T00:00:00.000Z" }
  ];
}

describe("resolvePublicOrganization", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-19T12:00:00.000Z"));
    createSupabaseServerClientMock.mockReset();
    cookiesMock.mockReset();
    noStoreMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("prioriza el query param por encima de la cookie", async () => {
    const fake = createFakeSupabase({
      organizations: buildOrganizations()
    });

    createSupabaseServerClientMock.mockResolvedValue(fake.client);
    cookiesMock.mockResolvedValue({
      get(name: string) {
        if (name === ACTIVE_ORG_COOKIE) {
          return { value: "liga-a" };
        }
        return undefined;
      }
    });

    const result = await resolvePublicOrganization("liga-b");

    expect(result.selectedOrganization?.slug).toBe("liga-b");
  });

  it("usa la cookie si no hay query param", async () => {
    const fake = createFakeSupabase({
      organizations: buildOrganizations()
    });

    createSupabaseServerClientMock.mockResolvedValue(fake.client);
    cookiesMock.mockResolvedValue({
      get(name: string) {
        if (name === ACTIVE_ORG_COOKIE) {
          return { value: "liga-a" };
        }
        return undefined;
      }
    });

    const result = await resolvePublicOrganization(null);

    expect(result.selectedOrganization?.slug).toBe("liga-a");
  });

  it("cae en un default contextual seguro si no hay seleccion previa", async () => {
    const fake = createFakeSupabase({
      organizations: [{ id: "org-1", name: "Liga A", slug: "liga-a", is_public: true, created_at: "2026-04-01T00:00:00.000Z" }]
    });

    createSupabaseServerClientMock.mockResolvedValue(fake.client);
    cookiesMock.mockResolvedValue({
      get() {
        return undefined;
      }
    });

    const result = await resolvePublicOrganization(undefined, { defaultContext: "home" });

    expect(result.selectedOrganization?.slug).toBe("liga-a");
  });

  it("devuelve solo las organizaciones administradas por el usuario, ordenadas por nombre", async () => {
    const fake = createFakeSupabase({
      authUser: {
        id: "admin-1",
        email: "admin@example.com"
      },
      organizations: [
        { id: "org-z", name: "Zulu", slug: "zulu", is_public: true, created_at: "2026-04-01T00:00:00.000Z" },
        { id: "org-a", name: "Alpha", slug: "alpha", is_public: true, created_at: "2026-04-02T00:00:00.000Z" },
        { id: "org-b", name: "Beta", slug: "beta", is_public: true, created_at: "2026-04-03T00:00:00.000Z" }
      ],
      organization_admins: [
        { organization_id: "org-z", admin_id: "admin-1", created_by: "admin-1" },
        { organization_id: "org-a", admin_id: "admin-1", created_by: "admin-1" },
        { organization_id: "org-b", admin_id: "admin-2", created_by: "admin-2" }
      ]
    });

    createSupabaseServerClientMock.mockResolvedValue(fake.client);
    cookiesMock.mockResolvedValue({ get: () => undefined });

    const organizations = await getViewerAdminOrganizations();

    expect(organizations.map((organization) => organization.name)).toEqual(["Alpha", "Zulu"]);
  });

  it("devuelve vacio si no hay usuario autenticado al pedir organizaciones admin", async () => {
    const fake = createFakeSupabase({
      authUser: null,
      organizations: buildOrganizations(),
      organization_admins: [{ organization_id: "org-1", admin_id: "admin-1", created_by: "admin-1" }]
    });

    createSupabaseServerClientMock.mockResolvedValue(fake.client);
    cookiesMock.mockResolvedValue({ get: () => undefined });

    await expect(getViewerAdminOrganizations()).resolves.toEqual([]);
  });

  it("resume correctamente el home publico de una organizacion", async () => {
    const fake = createFakeSupabase({
      players: buildPlayers(),
      matches: [
        {
          id: "match-finished",
          organization_id: ORG_ID,
          scheduled_at: "2026-04-18T20:00:00.000Z",
          modality: "5v5",
          status: "finished"
        },
        {
          id: "match-upcoming",
          organization_id: ORG_ID,
          scheduled_at: "2026-04-20T20:00:00.000Z",
          modality: "5v5",
          status: "confirmed"
        },
        {
          id: "match-past-confirmed",
          organization_id: ORG_ID,
          scheduled_at: "2026-04-10T20:00:00.000Z",
          modality: "5v5",
          status: "confirmed"
        }
      ]
    });

    createSupabaseServerClientMock.mockResolvedValue(fake.client);
    cookiesMock.mockResolvedValue({ get: () => undefined });

    const summary = await getHomeSummary(ORG_ID);

    expect(summary).toEqual({
      totalPlayers: 4,
      totalFinishedMatches: 1,
      upcomingMatches: [
        expect.objectContaining({
          id: "match-upcoming",
          status: "confirmed"
        }),
        expect.objectContaining({
          id: "match-past-confirmed",
          status: "confirmed"
        })
      ],
      topPlayers: [
        expect.objectContaining({ id: "player-1", current_rating: 1200 }),
        expect.objectContaining({ id: "player-2", current_rating: 1140 }),
        expect.objectContaining({ id: "player-3", current_rating: 1090 }),
        expect.objectContaining({ id: "player-4", current_rating: 1040 })
      ]
    });
  });

  it("ordena el top del grupo con los mismos desempates que ranking", async () => {
    const fake = createFakeSupabase({
      players: [
        {
          id: "player-lucas",
          organization_id: ORG_ID,
          full_name: "LucasDias",
          initial_rank: 2,
          skill_level: 3,
          display_order: 2,
          current_rating: 1030,
          active: true
        },
        {
          id: "player-gonza",
          organization_id: ORG_ID,
          full_name: "GonzaMastro",
          initial_rank: 1,
          skill_level: 1,
          display_order: 1,
          current_rating: 1030,
          active: true
        }
      ],
      matches: [
        {
          id: "match-1",
          organization_id: ORG_ID,
          scheduled_at: "2026-04-18T20:00:00.000Z",
          modality: "5v5",
          status: "finished"
        }
      ],
      team_options: [
        {
          id: "option-1",
          match_id: "match-1",
          option_number: 1,
          is_confirmed: true,
          rating_sum_a: 10,
          rating_sum_b: 10,
          rating_diff: 0,
          created_by: "admin-1"
        }
      ],
      team_option_players: [{ team_option_id: "option-1", player_id: "player-lucas", team: "A" }],
      match_result: [{ match_id: "match-1", score_a: 1, score_b: 0, winner_team: "A", created_by: "admin-1" }]
    });

    createSupabaseServerClientMock.mockResolvedValue(fake.client);
    cookiesMock.mockResolvedValue({ get: () => undefined });

    const summary = await getHomeSummary(ORG_ID);

    expect(summary.topPlayers.map((player) => player.id)).toEqual(["player-lucas", "player-gonza"]);
  });

  it("corrige el top del snapshot usando el orden cacheado de standings", async () => {
    const fake = createFakeSupabase({
      organization_public_snapshots: [
        {
          organization_id: ORG_ID,
          summary: {
            totalPlayers: 2,
            totalFinishedMatches: 1,
            upcomingMatches: [],
            topPlayers: [
              {
                id: "player-gonza",
                full_name: "GonzaMastro",
                current_rating: 1030,
                initial_rank: 1
              },
              {
                id: "player-lucas",
                full_name: "LucasDias",
                current_rating: 1030,
                initial_rank: 2
              }
            ]
          },
          standings: [
            {
              playerId: "player-lucas",
              playerName: "LucasDias",
              currentRating: 1030,
              initialRank: 2,
              currentRank: 1,
              matchesPlayed: 1,
              wins: 1,
              draws: 0,
              losses: 0,
              winRate: 100,
              streak: "W1",
              goals: 0,
              assists: 0
            },
            {
              playerId: "player-gonza",
              playerName: "GonzaMastro",
              currentRating: 1030,
              initialRank: 1,
              currentRank: 2,
              matchesPlayed: 0,
              wins: 0,
              draws: 0,
              losses: 0,
              winRate: 0,
              streak: "-",
              goals: 0,
              assists: 0
            }
          ],
          match_history: []
        }
      ]
    });

    createSupabaseServerClientMock.mockResolvedValue(fake.client);
    cookiesMock.mockResolvedValue({ get: () => undefined });

    const summary = await getHomeSummary(ORG_ID);

    expect(summary.topPlayers.map((player) => player.id)).toEqual(["player-lucas", "player-gonza"]);
  });

  it("interpreta los confirmados de hoy contra la hora de cancha, no contra UTC del servidor", async () => {
    vi.setSystemTime(new Date("2026-04-27T21:00:00.000Z")); // 18:00 en Argentina.
    const fake = createFakeSupabase({
      matches: [
        {
          id: "match-tonight",
          organization_id: ORG_ID,
          scheduled_at: "2026-04-27T20:00:00.000Z",
          modality: "5v5",
          status: "confirmed"
        },
        {
          id: "match-overdue",
          organization_id: ORG_ID,
          scheduled_at: "2026-04-27T17:00:00.000Z",
          modality: "5v5",
          status: "confirmed"
        }
      ]
    });

    createSupabaseServerClientMock.mockResolvedValue(fake.client);
    cookiesMock.mockResolvedValue({ get: () => undefined });

    const summary = await getHomeSummary(ORG_ID);

    expect(summary.upcomingMatches.map((match) => match.id)).toEqual(["match-tonight", "match-overdue"]);
  });

  it("pagina el historial de partidos y normaliza score y ganador", async () => {
    const fake = createFakeSupabase({
      matches: [
        {
          id: "match-cancelled",
          organization_id: ORG_ID,
          scheduled_at: "2026-04-19T21:00:00.000Z",
          modality: "5v5",
          status: "cancelled"
        },
        {
          id: "match-finished-2",
          organization_id: ORG_ID,
          scheduled_at: "2026-04-18T21:00:00.000Z",
          modality: "5v5",
          status: "finished"
        },
        {
          id: "match-finished-1",
          organization_id: ORG_ID,
          scheduled_at: "2026-04-17T21:00:00.000Z",
          modality: "5v5",
          status: "finished"
        },
        {
          id: "match-draft",
          organization_id: ORG_ID,
          scheduled_at: "2026-04-16T21:00:00.000Z",
          modality: "5v5",
          status: "draft"
        }
      ],
      team_options: [
        {
          id: "option-2",
          match_id: "match-finished-2",
          option_number: 1,
          is_confirmed: true,
          rating_sum_a: 20,
          rating_sum_b: 19,
          rating_diff: 1,
          created_by: "admin-1"
        },
        {
          id: "option-1",
          match_id: "match-finished-1",
          option_number: 1,
          is_confirmed: true,
          rating_sum_a: 19,
          rating_sum_b: 19,
          rating_diff: 0,
          created_by: "admin-1"
        }
      ],
      team_option_players: [
        { team_option_id: "option-2", player_id: "player-1", team: "A" },
        { team_option_id: "option-2", player_id: "player-2", team: "B" },
        { team_option_id: "option-1", player_id: "player-3", team: "A" },
        { team_option_id: "option-1", player_id: "player-4", team: "B" }
      ],
      match_result: [
        { match_id: "match-finished-2", score_a: 3, score_b: 1, winner_team: "A", created_by: "admin-1" },
        { match_id: "match-finished-1", score_a: 2, score_b: 2, winner_team: null, created_by: "admin-1" }
      ]
    });

    createSupabaseServerClientMock.mockResolvedValue(fake.client);
    cookiesMock.mockResolvedValue({ get: () => undefined });

    const firstPage = await getMatchHistoryCardsPage(ORG_ID, { page: 1, pageSize: 2 });
    const secondPage = await getMatchHistoryCardsPage(ORG_ID, { page: 2, pageSize: 2 });

    expect(firstPage.matches).toEqual([
      expect.objectContaining({
        id: "match-cancelled",
        status: "cancelled",
        scoreA: null,
        scoreB: null
      }),
      expect.objectContaining({
        id: "match-finished-2",
        status: "finished",
        scoreA: 3,
        scoreB: 1,
        winnerTeam: "A"
      })
    ]);
    expect(firstPage.pagination).toEqual({
      page: 1,
      pageSize: 2,
      totalCount: 3,
      totalPages: 2,
      hasNextPage: true,
      hasPreviousPage: false
    });
    expect(secondPage.matches.map((match) => match.id)).toEqual(["match-finished-1"]);
    expect(secondPage.pagination.hasPreviousPage).toBe(true);
  });

  it("mezcla jugadores e invitados en proximos partidos y ordena invitados por nivel equivalente", async () => {
    const fake = createFakeSupabase({
      players: buildPlayers(),
      matches: [
        {
          id: "match-1",
          organization_id: ORG_ID,
          scheduled_at: "2026-04-21T21:00:00.000Z",
          modality: "5v5",
          status: "confirmed",
          confirmed_option_id: "option-1"
        }
      ],
      team_options: [
        {
          id: "option-1",
          match_id: "match-1",
          option_number: 1,
          is_confirmed: true,
          rating_sum_a: 20,
          rating_sum_b: 20,
          rating_diff: 0,
          created_by: "admin-1"
        }
      ],
      team_option_players: [
        { team_option_id: "option-1", player_id: "player-1", team: "A" },
        { team_option_id: "option-1", player_id: "player-4", team: "A" },
        { team_option_id: "option-1", player_id: "player-2", team: "B" },
        { team_option_id: "option-1", player_id: "player-3", team: "B" }
      ],
      match_guests: [
        { id: "guest-1", match_id: "match-1", guest_name: "Invitado Top", guest_rating: 0.5 },
        { id: "guest-2", match_id: "match-1", guest_name: "Invitado Bajo", guest_rating: 5 }
      ],
      team_option_guests: [
        { team_option_id: "option-1", guest_id: "guest-1", team: "A" },
        { team_option_id: "option-1", guest_id: "guest-2", team: "B" }
      ]
    });

    createSupabaseServerClientMock.mockResolvedValue(fake.client);
    cookiesMock.mockResolvedValue({ get: () => undefined });

    const matches = await getUpcomingConfirmedMatches(ORG_ID);

    expect(matches).toHaveLength(1);
    expect(matches[0]?.teamAPlayers.map((player) => player.full_name)).toEqual([
      "Arquero",
      "Invitado Top",
      "Delantero"
    ]);
    expect(matches[0]?.teamBPlayers.map((player) => player.full_name)).toEqual([
      "Defensor",
      "Volante",
      "Invitado Bajo"
    ]);
    expect(matches[0]?.teamAPlayers[1]).toEqual(
      expect.objectContaining({
        is_guest: true
      })
    );
  });

  it("tolera la falta del schema de invitados en proximos partidos y sigue mostrando jugadores", async () => {
    const fake = createFakeSupabase({
      players: buildPlayers(),
      matches: [
        {
          id: "match-1",
          organization_id: ORG_ID,
          scheduled_at: "2026-04-21T21:00:00.000Z",
          modality: "5v5",
          status: "confirmed",
          confirmed_option_id: "option-1"
        }
      ],
      team_options: [
        {
          id: "option-1",
          match_id: "match-1",
          option_number: 1,
          is_confirmed: true,
          rating_sum_a: 20,
          rating_sum_b: 20,
          rating_diff: 0,
          created_by: "admin-1"
        }
      ],
      team_option_players: [
        { team_option_id: "option-1", player_id: "player-1", team: "A" },
        { team_option_id: "option-1", player_id: "player-2", team: "B" }
      ],
      queryFailures: {
        team_option_guests: {
          select: 'relation "team_option_guests" does not exist'
        },
        match_guests: {
          select: 'relation "match_guests" does not exist'
        }
      }
    });

    createSupabaseServerClientMock.mockResolvedValue(fake.client);
    cookiesMock.mockResolvedValue({ get: () => undefined });

    const matches = await getUpcomingConfirmedMatches(ORG_ID);

    expect(matches).toHaveLength(1);
    expect(matches[0]?.teamAPlayers).toEqual([
      expect.objectContaining({ full_name: "Arquero", is_guest: false })
    ]);
    expect(matches[0]?.teamBPlayers).toEqual([
      expect.objectContaining({ full_name: "Defensor", is_guest: false })
    ]);
  });

  it("resuelve el detalle de un partido publico con invitados y resultado", async () => {
    const fake = createFakeSupabase({
      organizations: buildOrganizations(),
      players: buildPlayers(),
      matches: [
        {
          id: "match-1",
          organization_id: ORG_ID,
          scheduled_at: "2026-04-21T21:00:00.000Z",
          modality: "5v5",
          status: "finished",
          confirmed_option_id: "option-1"
        }
      ],
      team_options: [
        {
          id: "option-1",
          match_id: "match-1",
          option_number: 1,
          is_confirmed: true,
          rating_sum_a: 20,
          rating_sum_b: 20,
          rating_diff: 0,
          created_by: "admin-1"
        }
      ],
      team_option_players: [
        { team_option_id: "option-1", player_id: "player-1", team: "A" },
        { team_option_id: "option-1", player_id: "player-2", team: "B" }
      ],
      match_guests: [{ id: "guest-1", match_id: "match-1", guest_name: "Invitado", guest_rating: 1110 }],
      team_option_guests: [{ team_option_id: "option-1", guest_id: "guest-1", team: "A" }],
      match_result: [{ match_id: "match-1", score_a: 2, score_b: 1, winner_team: "A", created_by: "admin-1" }]
    });

    createSupabaseServerClientMock.mockResolvedValue(fake.client);
    cookiesMock.mockResolvedValue({ get: () => undefined });

    const details = await getMatchDetails("match-1", "liga-a");

    expect(details?.result).toEqual(
      expect.objectContaining({
        score_a: 2,
        score_b: 1,
        winner_team: "A"
      })
    );
    expect(details?.teamAPlayers.map((player) => player.full_name)).toEqual(["Arquero", "Invitado"]);
    expect(details?.teamAPlayers[1]).toEqual(
      expect.objectContaining({
        is_guest: true
      })
    );
    expect(details?.teamBPlayers.map((player) => player.full_name)).toEqual(["Defensor"]);
  });

  it("calcula estadisticas publicas por jugador a partir de partidos finalizados", async () => {
    const fake = createFakeSupabase({
      players: buildPlayers(),
      matches: [
        {
          id: "match-older",
          organization_id: ORG_ID,
          scheduled_at: "2026-04-10T21:00:00.000Z",
          modality: "5v5",
          status: "finished"
        },
        {
          id: "match-newer",
          organization_id: ORG_ID,
          scheduled_at: "2026-04-15T21:00:00.000Z",
          modality: "5v5",
          status: "finished"
        }
      ],
      team_options: [
        {
          id: "option-older",
          match_id: "match-older",
          option_number: 1,
          is_confirmed: true,
          created_by: "admin-1",
          rating_sum_a: 20,
          rating_sum_b: 20,
          rating_diff: 0
        },
        {
          id: "option-newer",
          match_id: "match-newer",
          option_number: 1,
          is_confirmed: true,
          created_by: "admin-1",
          rating_sum_a: 20,
          rating_sum_b: 20,
          rating_diff: 0
        }
      ],
      team_option_players: [
        { team_option_id: "option-older", player_id: "player-1", team: "A" },
        { team_option_id: "option-older", player_id: "player-2", team: "A" },
        { team_option_id: "option-older", player_id: "player-3", team: "B" },
        { team_option_id: "option-older", player_id: "player-4", team: "B" },
        { team_option_id: "option-newer", player_id: "player-1", team: "A" },
        { team_option_id: "option-newer", player_id: "player-3", team: "A" },
        { team_option_id: "option-newer", player_id: "player-2", team: "B" },
        { team_option_id: "option-newer", player_id: "player-4", team: "B" }
      ],
      match_result: [
        { match_id: "match-older", score_a: 2, score_b: 0, winner_team: "A", created_by: "admin-1" },
        { match_id: "match-newer", score_a: 1, score_b: 1, winner_team: "DRAW", created_by: "admin-1" }
      ],
      match_player_stats: [
        { match_id: "match-older", player_id: "player-1", goals: 1, assists: 1 },
        { match_id: "match-older", player_id: "player-2", goals: 1, assists: 0 },
        { match_id: "match-newer", player_id: "player-1", goals: 0, assists: 1 },
        { match_id: "match-newer", player_id: "player-3", goals: 1, assists: 0 }
      ]
    });

    createSupabaseServerClientMock.mockResolvedValue(fake.client);
    cookiesMock.mockResolvedValue({ get: () => undefined });

    const stats = await getPlayersWithStats(ORG_ID);

    expect(stats[0]).toEqual(
      expect.objectContaining({
        playerId: "player-1",
        matchesPlayed: 2,
        wins: 1,
        draws: 1,
        losses: 0,
        streak: "D1",
        goals: 1,
        assists: 2
      })
    );
    expect(stats[1]).toEqual(
      expect.objectContaining({
        playerId: "player-2",
        matchesPlayed: 2,
        wins: 1,
        draws: 1,
        losses: 0
      })
    );
    expect(stats.find((player) => player.playerId === "player-4")).toEqual(
      expect.objectContaining({
        matchesPlayed: 2,
        wins: 0,
        draws: 1,
        losses: 1,
        streak: "D1"
      })
    );
  });

  it("resuelve el detalle publico de un jugador con stats e historial de rating", async () => {
    const fake = createFakeSupabase({
      players: buildPlayers(),
      matches: [
        {
          id: "match-1",
          organization_id: ORG_ID,
          scheduled_at: "2026-04-10T21:00:00.000Z",
          modality: "5v5",
          status: "finished"
        }
      ],
      team_options: [
        {
          id: "option-1",
          match_id: "match-1",
          option_number: 1,
          is_confirmed: true,
          created_by: "admin-1",
          rating_sum_a: 20,
          rating_sum_b: 20,
          rating_diff: 0
        }
      ],
      team_option_players: [
        { team_option_id: "option-1", player_id: "player-1", team: "A" },
        { team_option_id: "option-1", player_id: "player-2", team: "A" },
        { team_option_id: "option-1", player_id: "player-3", team: "B" },
        { team_option_id: "option-1", player_id: "player-4", team: "B" }
      ],
      match_result: [{ match_id: "match-1", score_a: 2, score_b: 1, winner_team: "A", created_by: "admin-1" }],
      match_player_stats: [{ match_id: "match-1", player_id: "player-1", goals: 2, assists: 0 }],
      rating_history: [
        {
          id: "history-1",
          match_id: "match-1",
          player_id: "player-1",
          rating_before: 1180,
          rating_after: 1200,
          delta: 20,
          created_at: "2026-04-11T10:00:00.000Z"
        },
        {
          id: "history-2",
          match_id: "match-0",
          player_id: "player-1",
          rating_before: 1160,
          rating_after: 1180,
          delta: 20,
          created_at: "2026-04-01T10:00:00.000Z"
        }
      ]
    });

    createSupabaseServerClientMock.mockResolvedValue(fake.client);
    cookiesMock.mockResolvedValue({ get: () => undefined });

    const details = await getPlayerDetails("player-1");

    expect(details?.player).toEqual(expect.objectContaining({ id: "player-1", full_name: "Arquero" }));
    expect(details?.playerStats).toEqual(
      expect.objectContaining({
        playerId: "player-1",
        matchesPlayed: 1,
        wins: 1,
        goals: 2
      })
    );
    expect(details?.ratingHistory).toEqual([
      expect.objectContaining({ id: "history-1", rating_after: 1200 }),
      expect.objectContaining({ id: "history-2", rating_after: 1180 })
    ]);
  });

  it("devuelve null en detalle de jugador si la organizacion publica no coincide", async () => {
    const fake = createFakeSupabase({
      organizations: buildOrganizations(),
      players: buildPlayers()
    });

    createSupabaseServerClientMock.mockResolvedValue(fake.client);
    cookiesMock.mockResolvedValue({ get: () => undefined });

    await expect(getPlayerDetails("player-1", "liga-b")).resolves.toBeNull();
  });
});
