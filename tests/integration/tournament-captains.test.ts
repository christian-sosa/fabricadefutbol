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

import { getCaptainAssignments } from "@/lib/auth/captains";
import { getAdminTournamentDetails, getCaptainTournamentTeamPanelData } from "@/lib/queries/tournaments";
import { createFakeSupabase } from "../helpers/fake-supabase";

describe("tournament captains", () => {
  beforeEach(() => {
    createSupabaseServerClientMock.mockReset();
    noStoreMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("enriquece asignaciones de capitan con torneo y equipo", async () => {
    const fake = createFakeSupabase({
      tournaments: [
        {
          id: "t-1",
          name: "Apertura",
          slug: "apertura",
          season_label: "2026",
          status: "active",
          is_public: true,
          created_by: "admin-1"
        }
      ],
      tournament_teams: [
        {
          id: "team-a",
          tournament_id: "t-1",
          name: "Alfa",
          short_name: "ALF",
          slug: "alfa",
          display_order: 1
        }
      ],
      tournament_team_captains: [
        {
          id: "captain-link-1",
          tournament_id: "t-1",
          team_id: "team-a",
          captain_id: "captain-1",
          created_by: "admin-1",
          created_at: "2026-04-21T10:00:00.000Z"
        }
      ]
    });

    createSupabaseServerClientMock.mockResolvedValue(fake.client);

    await expect(getCaptainAssignments("captain-1")).resolves.toEqual([
      expect.objectContaining({
        assignmentId: "captain-link-1",
        tournamentId: "t-1",
        teamId: "team-a",
        tournamentName: "Apertura",
        tournamentSlug: "apertura",
        teamName: "Alfa",
        seasonLabel: "2026"
      })
    ]);
  });

  it("arma el panel de capitan con roster y partidos del equipo asignado", async () => {
    const fake = createFakeSupabase({
      tournaments: [
        {
          id: "t-1",
          name: "Apertura",
          slug: "apertura",
          season_label: "2026",
          status: "active",
          is_public: true,
          created_by: "admin-1"
        }
      ],
      tournament_teams: [
        { id: "team-a", tournament_id: "t-1", name: "Alfa", short_name: "ALF", slug: "alfa", display_order: 1 },
        { id: "team-b", tournament_id: "t-1", name: "Beta", short_name: "BET", slug: "beta", display_order: 2 }
      ],
      tournament_players: [
        { id: "player-a1", tournament_id: "t-1", team_id: "team-a", full_name: "Juan Alfa", shirt_number: 9 },
        { id: "player-a2", tournament_id: "t-1", team_id: "team-a", full_name: "Luis Alfa", shirt_number: 5 },
        { id: "player-b1", tournament_id: "t-1", team_id: "team-b", full_name: "Pedro Beta", shirt_number: 10 }
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
          venue: "Cancha 1",
          status: "played",
          created_by: "admin-1"
        }
      ],
      tournament_match_results: [
        {
          match_id: "match-1",
          home_score: 2,
          away_score: 1,
          mvp_player_id: "player-a1",
          mvp_player_name: "Juan Alfa",
          created_by: "admin-1"
        }
      ]
    });

    createSupabaseServerClientMock.mockResolvedValue(fake.client);

    const data = await getCaptainTournamentTeamPanelData({
      tournamentId: "t-1",
      teamId: "team-a"
    });

    expect(data).toEqual(
      expect.objectContaining({
        tournament: expect.objectContaining({
          slug: "apertura"
        }),
        team: expect.objectContaining({
          id: "team-a",
          name: "Alfa"
        }),
        roster: [
          expect.objectContaining({ id: "player-a1" }),
          expect.objectContaining({ id: "player-a2" })
        ],
        standingRow: expect.objectContaining({
          teamId: "team-a",
          points: 3
        }),
        teamMatches: [
          expect.objectContaining({
            id: "match-1",
            homeTeamId: "team-a",
            awayTeamId: "team-b",
            homeScore: 2,
            awayScore: 1
          })
        ]
      })
    );
  });

  it("incluye capitanes e invitaciones pendientes en el detalle admin del torneo", async () => {
    const fake = createFakeSupabase({
      admins: [
        { id: "captain-1", display_name: "Capitan Alfa" },
        { id: "admin-1", display_name: "Admin Torneo" }
      ],
      tournaments: [
        {
          id: "t-1",
          name: "Apertura",
          slug: "apertura",
          season_label: "2026",
          status: "draft",
          is_public: false,
          created_by: "admin-1"
        }
      ],
      tournament_teams: [
        { id: "team-a", tournament_id: "t-1", name: "Alfa", short_name: "ALF", slug: "alfa", display_order: 1 },
        { id: "team-b", tournament_id: "t-1", name: "Beta", short_name: "BET", slug: "beta", display_order: 2 }
      ],
      tournament_team_captains: [
        {
          id: "team-captain-1",
          tournament_id: "t-1",
          team_id: "team-a",
          captain_id: "captain-1",
          created_by: "admin-1",
          created_at: "2026-04-21T10:00:00.000Z"
        }
      ],
      tournament_captain_invites: [
        {
          id: "invite-1",
          tournament_id: "t-1",
          team_id: "team-b",
          email: "beta@example.com",
          invite_token: "token-beta",
          created_by: "admin-1",
          expires_at: "2026-05-05T00:00:00.000Z",
          created_at: "2026-04-21T11:00:00.000Z"
        }
      ]
    });

    createSupabaseServerClientMock.mockResolvedValue(fake.client);

    const details = await getAdminTournamentDetails("t-1");

    expect(details?.teamCaptainsByTeam.get("team-a")).toEqual(
      expect.objectContaining({
        teamId: "team-a",
        captainId: "captain-1",
        displayName: "Capitan Alfa"
      })
    );
    expect(details?.captainInvitesByTeam.get("team-b")).toEqual(
      expect.objectContaining({
        teamId: "team-b",
        email: "beta@example.com",
        inviteToken: "token-beta"
      })
    );
  });

  it("tolera tablas auxiliares faltantes del schema admin", async () => {
    const fake = createFakeSupabase({
      tournaments: [
        {
          id: "t-1",
          name: "Apertura",
          slug: "apertura",
          season_label: "2026",
          status: "draft",
          is_public: false,
          created_by: "admin-1"
        }
      ],
      tournament_teams: [
        { id: "team-a", tournament_id: "t-1", name: "Alfa", short_name: "ALF", slug: "alfa", display_order: 1 }
      ],
      queryFailures: {
        tournament_admin_invites: {
          select: "Could not find the table 'app_prod.tournament_admin_invites' in the schema cache"
        },
        tournament_team_captains: {
          select: "Could not find the table 'app_prod.tournament_team_captains' in the schema cache"
        },
        tournament_captain_invites: {
          select: "Could not find the table 'app_prod.tournament_captain_invites' in the schema cache"
        }
      }
    });

    createSupabaseServerClientMock.mockResolvedValue(fake.client);

    const details = await getAdminTournamentDetails("t-1");

    expect(details?.tournament.name).toBe("Apertura");
    expect(details?.tournamentAdmins.pendingInvites).toEqual([]);
    expect(details?.teamCaptainsByTeam.size).toBe(0);
    expect(details?.captainInvitesByTeam.size).toBe(0);
    expect(details?.schemaSupport).toEqual({
      tournamentAdminInvites: false,
      tournamentTeamCaptains: false,
      tournamentCaptainInvites: false
    });
  });
});
