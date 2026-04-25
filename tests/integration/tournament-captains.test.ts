import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createSupabaseServerClientMock, createSupabaseAdminClientMock, noStoreMock } = vi.hoisted(
  () => ({
    createSupabaseServerClientMock: vi.fn(),
    createSupabaseAdminClientMock: vi.fn(),
    noStoreMock: vi.fn()
  })
);

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: createSupabaseAdminClientMock
}));

vi.mock("next/cache", () => ({
  unstable_noStore: noStoreMock,
  revalidatePath: vi.fn()
}));

import { getCaptainAssignments } from "@/lib/auth/captains";
import {
  getAdminCompetitionDetails,
  getAdminLeagueDetails,
  getCaptainCompetitionTeamPanelData
} from "@/lib/queries/tournaments";
import { createFakeSupabase } from "../helpers/fake-supabase";

describe("competition captains", () => {
  beforeEach(() => {
    createSupabaseServerClientMock.mockReset();
    createSupabaseAdminClientMock.mockReset();
    createSupabaseAdminClientMock.mockReturnValue(null);
    noStoreMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("enriquece asignaciones de capitan con liga, competencia y equipo inscripto", async () => {
    const fake = createFakeSupabase({
      leagues: [{ id: "league-1", name: "LAFAB", slug: "lafab", status: "active", is_public: true }],
      competitions: [
        {
          id: "competition-1",
          league_id: "league-1",
          name: "Viernes A",
          slug: "viernes-a",
          season_label: "2026",
          status: "active",
          is_public: true
        },
        {
          id: "competition-2",
          league_id: "league-1",
          name: "Viernes B",
          slug: "viernes-b",
          season_label: "2026",
          status: "active",
          is_public: true
        }
      ],
      competition_teams: [
        {
          id: "competition-team-a1",
          competition_id: "competition-1",
          league_team_id: "league-team-a",
          display_name: "Alfa",
          short_name: "ALF",
          display_order: 1
        },
        {
          id: "competition-team-a2",
          competition_id: "competition-2",
          league_team_id: "league-team-a",
          display_name: "Alfa",
          short_name: "ALF",
          display_order: 1
        }
      ],
      competition_team_captains: [
        {
          id: "captain-link-1",
          competition_id: "competition-1",
          competition_team_id: "competition-team-a1",
          captain_id: "captain-1",
          created_by: "admin-1",
          created_at: "2026-04-21T10:00:00.000Z"
        },
        {
          id: "captain-link-2",
          competition_id: "competition-2",
          competition_team_id: "competition-team-a2",
          captain_id: "captain-2",
          created_by: "admin-1",
          created_at: "2026-04-21T11:00:00.000Z"
        }
      ]
    });

    createSupabaseServerClientMock.mockResolvedValue(fake.client);

    await expect(getCaptainAssignments("captain-1")).resolves.toEqual([
      expect.objectContaining({
        assignmentId: "captain-link-1",
        leagueId: "league-1",
        leagueName: "LAFAB",
        competitionId: "competition-1",
        competitionName: "Viernes A",
        competitionSlug: "viernes-a",
        competitionTeamId: "competition-team-a1",
        leagueTeamId: "league-team-a",
        teamName: "Alfa"
      })
    ]);
  });

  it("arma el panel del capitan con el plantel y partidos de su competencia", async () => {
    const fake = createFakeSupabase({
      leagues: [{ id: "league-1", name: "LAFAB", slug: "lafab", status: "active", is_public: true }],
      competitions: [
        {
          id: "competition-1",
          league_id: "league-1",
          name: "Viernes A",
          slug: "viernes-a",
          season_label: "2026",
          status: "active",
          is_public: true
        },
        {
          id: "competition-2",
          league_id: "league-1",
          name: "Viernes B",
          slug: "viernes-b",
          season_label: "2026",
          status: "active",
          is_public: true
        }
      ],
      competition_teams: [
        {
          id: "competition-team-a1",
          competition_id: "competition-1",
          league_team_id: "league-team-a",
          display_name: "Alfa",
          short_name: "ALF",
          display_order: 1
        },
        {
          id: "competition-team-b1",
          competition_id: "competition-1",
          league_team_id: "league-team-b",
          display_name: "Beta",
          short_name: "BET",
          display_order: 2
        },
        {
          id: "competition-team-a2",
          competition_id: "competition-2",
          league_team_id: "league-team-a",
          display_name: "Alfa",
          short_name: "ALF",
          display_order: 1
        }
      ],
      competition_team_players: [
        {
          id: "player-a1",
          competition_team_id: "competition-team-a1",
          full_name: "Juan Alfa",
          shirt_number: 9
        },
        {
          id: "player-a2",
          competition_team_id: "competition-team-a1",
          full_name: "Luis Alfa",
          shirt_number: 5
        },
        {
          id: "player-alt",
          competition_team_id: "competition-team-a2",
          full_name: "Otro Plantel",
          shirt_number: 7
        }
      ],
      competition_rounds: [
        { id: "round-1", competition_id: "competition-1", round_number: 1, name: "Fecha 1" }
      ],
      competition_matches: [
        {
          id: "match-1",
          competition_id: "competition-1",
          round_id: "round-1",
          home_team_id: "competition-team-a1",
          away_team_id: "competition-team-b1",
          scheduled_at: "2026-04-25T20:00:00.000Z",
          venue: "Cancha 1",
          status: "played",
          created_by: "admin-1"
        }
      ],
      competition_match_results: [
        {
          match_id: "match-1",
          home_score: 2,
          away_score: 1,
          mvp_player_id: "player-a1",
          mvp_player_name: "Juan Alfa"
        }
      ]
    });

    createSupabaseServerClientMock.mockResolvedValue(fake.client);

    const data = await getCaptainCompetitionTeamPanelData({
      competitionId: "competition-1",
      competitionTeamId: "competition-team-a1"
    });

    expect(data).toEqual(
      expect.objectContaining({
        competition: expect.objectContaining({
          slug: "viernes-a"
        }),
        team: expect.objectContaining({
          id: "competition-team-a1",
          displayName: "Alfa"
        }),
        roster: [
          expect.objectContaining({ id: "player-a1" }),
          expect.objectContaining({ id: "player-a2" })
        ],
        standingRow: expect.objectContaining({
          teamId: "competition-team-a1",
          points: 3
        }),
        teamMatches: [
          expect.objectContaining({
            id: "match-1",
            homeTeamId: "competition-team-a1",
            awayTeamId: "competition-team-b1",
            homeScore: 2,
            awayScore: 1
          })
        ]
      })
    );
    expect(data?.roster.find((player) => player.id === "player-alt")).toBeUndefined();
  });

  it("incluye capitanes e invitaciones pendientes en el detalle admin de la competencia", async () => {
    const fake = createFakeSupabase({
      admins: [{ id: "captain-1", display_name: "Capitan Alfa" }],
      leagues: [{ id: "league-1", name: "LAFAB", slug: "lafab", status: "draft", is_public: false }],
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
          status: "draft",
          is_public: false
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
      competition_team_captains: [
        {
          id: "team-captain-1",
          competition_id: "competition-1",
          competition_team_id: "competition-team-a",
          captain_id: "captain-1",
          created_by: "admin-1",
          created_at: "2026-04-21T10:00:00.000Z"
        }
      ],
      competition_captain_invites: [
        {
          id: "invite-1",
          competition_id: "competition-1",
          competition_team_id: "competition-team-b",
          email: "beta@example.com",
          invite_token: "token-beta",
          created_by: "admin-1",
          expires_at: "2026-05-05T00:00:00.000Z",
          created_at: "2026-04-21T11:00:00.000Z"
        }
      ]
    });

    createSupabaseServerClientMock.mockResolvedValue(fake.client);

    const details = await getAdminCompetitionDetails({
      leagueId: "league-1",
      competitionId: "competition-1"
    });

    expect(details?.teamCaptainsByTeam.get("competition-team-a")).toEqual(
      expect.objectContaining({
        competitionTeamId: "competition-team-a",
        captainId: "captain-1",
        displayName: "Capitan Alfa"
      })
    );
    expect(details?.captainInvitesByTeam.get("competition-team-b")).toEqual(
      expect.objectContaining({
        competitionTeamId: "competition-team-b",
        email: "beta@example.com",
        inviteToken: "token-beta"
      })
    );
  });

  it("incluye admins e invitaciones pendientes en el detalle admin de la liga", async () => {
    const fake = createFakeSupabase({
      admins: [{ id: "admin-1", display_name: "Admin Liga" }],
      leagues: [
        {
          id: "league-1",
          name: "LAFAB",
          slug: "lafab",
          venue_name: "Parque Norte",
          status: "draft",
          is_public: false,
          created_by: "admin-1"
        }
      ],
      league_admins: [
        {
          id: "league-admin-1",
          league_id: "league-1",
          admin_id: "admin-1",
          role: "owner",
          created_by: "admin-1",
          created_at: "2026-04-21T09:00:00.000Z"
        }
      ],
      league_admin_invites: [
        {
          id: "invite-1",
          league_id: "league-1",
          email: "editor@example.com",
          invite_token: "invite-token-1",
          status: "pending",
          created_at: "2026-04-21T12:00:00.000Z",
          expires_at: "2099-05-05T00:00:00.000Z"
        }
      ],
      league_teams: [
        { id: "league-team-a", league_id: "league-1", name: "Alfa", short_name: "ALF", slug: "alfa" }
      ],
      competitions: [
        {
          id: "competition-1",
          league_id: "league-1",
          name: "Viernes A",
          slug: "viernes-a",
          season_label: "2026",
          status: "draft",
          is_public: false
        }
      ]
    });

    createSupabaseServerClientMock.mockResolvedValue(fake.client);
    createSupabaseAdminClientMock.mockReturnValue({
      auth: {
        admin: {
          listUsers: vi.fn().mockResolvedValue({
            data: {
              users: [{ id: "admin-1", email: "admin@example.com" }]
            },
            error: null
          })
        }
      }
    });

    const details = await getAdminLeagueDetails("league-1");

    expect(details).toEqual(
      expect.objectContaining({
        league: expect.objectContaining({
          slug: "lafab",
          teamCount: 1,
          competitionCount: 1
        }),
        leagueAdmins: expect.objectContaining({
          admins: [
            expect.objectContaining({
              id: "admin-1",
              membershipId: "league-admin-1",
              displayName: "Admin Liga",
              email: "admin@example.com",
              role: "owner"
            })
          ],
          pendingInvites: [
            expect.objectContaining({
              leagueId: "league-1",
              email: "editor@example.com",
              inviteToken: "invite-token-1"
            })
          ]
        })
      })
    );
  });
});
