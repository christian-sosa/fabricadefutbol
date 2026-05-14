import { describe, expect, it, vi } from "vitest";

const { createSupabaseServerClientMock, redirectMock, revalidatePathMock, refreshClubPublicSnapshotMock } = vi.hoisted(
  () => ({
    createSupabaseServerClientMock: vi.fn(),
    redirectMock: vi.fn((url: string) => {
      const error = new Error(`NEXT_REDIRECT: ${url}`) as Error & { digest: string; url: string };
      error.digest = `NEXT_REDIRECT;replace;${url};false`;
      error.url = url;
      throw error;
    }),
    revalidatePathMock: vi.fn(),
    refreshClubPublicSnapshotMock: vi.fn()
  })
);

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock
}));

vi.mock("@/lib/next-redirect", () => ({
  isNextRedirectError: (error: unknown) =>
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
}));

vi.mock("@/lib/auth/clubs", () => ({
  assertClubWriteAction: vi.fn(async () => ({
    userId: "00000000-0000-4000-8000-000000000001",
    email: "admin@example.com",
    displayName: "Admin",
    isSuperAdmin: false
  })),
  getClubSlugById: vi.fn(async () => "la-quinta")
}));

vi.mock("@/lib/queries/clubs", () => ({
  refreshClubPublicSnapshot: refreshClubPublicSnapshotMock
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock
}));

import {
  addClubCallupAction,
  addClubCallupGuestAction,
  addClubMatchAction,
  addClubTeamAction,
  updateClubTeamAction
} from "@/app/admin/(panel)/clubs/[clubId]/actions";
import { createFakeSupabase } from "../helpers/fake-supabase";

const clubId = "00000000-0000-4000-8000-000000000100";
const teamId = "00000000-0000-4000-8000-000000000200";
const competitionId = "00000000-0000-4000-8000-000000000300";

describe("club admin actions", () => {
  it("crea equipos de club con modalidad", async () => {
    const fake = createFakeSupabase();
    createSupabaseServerClientMock.mockResolvedValue(fake.client);

    const formData = new FormData();
    formData.set("name", "La Quinta F5");
    formData.set("shortName", "LQ5");
    formData.set("modality", "5v5");
    formData.set("notes", "Turno reducido");

    await expect(addClubTeamAction(clubId, formData)).rejects.toMatchObject({
      digest: expect.stringContaining(`/admin/clubs/${clubId}?tab=teams`)
    });

    expect(fake.find("club_teams", (row) => row.name === "La Quinta F5")).toMatchObject({
      club_id: clubId,
      short_name: "LQ5",
      modality: "5v5",
      notes: "Turno reducido",
      active: true
    });
  });

  it("actualiza la modalidad del equipo solo para partidos futuros", async () => {
    const fake = createFakeSupabase({
      club_teams: [
        {
          id: teamId,
          club_id: clubId,
          name: "La Quinta Senior",
          short_name: "LQ",
          modality: "11v11",
          active: true
        }
      ],
      club_matches: [
        {
          id: "00000000-0000-4000-8000-000000000400",
          club_id: clubId,
          club_team_id: teamId,
          club_competition_id: competitionId,
          modality: "11v11",
          played_at: "2026-05-01T20:00:00.000Z",
          opponent_name: "Rival",
          goals_for: 1,
          goals_against: 0,
          status: "played",
          created_by: "00000000-0000-4000-8000-000000000001"
        }
      ]
    });
    createSupabaseServerClientMock.mockResolvedValue(fake.client);

    const formData = new FormData();
    formData.set("teamId", teamId);
    formData.set("name", "La Quinta Senior");
    formData.set("shortName", "LQ7");
    formData.set("modality", "7v7");
    formData.set("active", "true");
    formData.set("notes", "Pasa a futbol 7");

    await expect(updateClubTeamAction(clubId, formData)).rejects.toMatchObject({
      digest: expect.stringContaining(`/admin/clubs/${clubId}?tab=teams&teamId=${teamId}`)
    });

    expect(fake.find("club_teams", (row) => row.id === teamId)).toMatchObject({
      modality: "7v7",
      short_name: "LQ7"
    });
    expect(fake.find("club_matches", (row) => row.club_team_id === teamId)).toMatchObject({
      modality: "11v11"
    });
  });

  it("copia la modalidad real del equipo al partido cargado", async () => {
    const players = Array.from({ length: 5 }, (_, index) => ({
      id: `00000000-0000-4000-8000-00000000050${index}`,
      club_id: clubId,
      full_name: `Jugador ${index + 1}`,
      active: true
    }));
    const fake = createFakeSupabase({
      club_teams: [
        {
          id: teamId,
          club_id: clubId,
          name: "La Quinta F5",
          short_name: "LQ5",
          modality: "5v5",
          active: true
        }
      ],
      club_competitions: [
        {
          id: competitionId,
          club_id: clubId,
          name: "LAFAB",
          slug: "lafab",
          active: true
        }
      ],
      club_players: players
    });
    createSupabaseServerClientMock.mockResolvedValue(fake.client);

    const formData = new FormData();
    formData.set("teamId", teamId);
    formData.set("competitionId", competitionId);
    formData.set("modality", "5v5");
    formData.set("playedDate", "2026-05-01");
    formData.set("playedTime", "20:00");
    formData.set("opponentName", "Rival F5");
    formData.set("venue", "");
    formData.set("goalsFor", "3");
    formData.set("goalsAgainst", "2");
    formData.set("notes", "");
    for (const player of players) {
      formData.set(`playerRole:${player.id}`, "starter");
      formData.set(`playerGoals:${player.id}`, player.id.endsWith("0") ? "3" : "0");
      formData.set(`playerAssists:${player.id}`, "0");
    }

    await expect(addClubMatchAction(clubId, formData)).rejects.toMatchObject({
      digest: expect.stringContaining(`/admin/clubs/${clubId}?tab=matches`)
    });

    expect(redirectMock).toHaveBeenLastCalledWith(expect.stringContaining("success=Partido+cargado."));
    expect(fake.find("club_matches", (row) => row.opponent_name === "Rival F5")).toMatchObject({
      club_id: clubId,
      club_team_id: teamId,
      modality: "5v5",
      goals_for: 3,
      goals_against: 2
    });
  });

  it("crea el control de pagos de cancha al cargar un partido", async () => {
    const players = Array.from({ length: 5 }, (_, index) => ({
      id: `00000000-0000-4000-8000-00000000060${index}`,
      club_id: clubId,
      full_name: `Jugador Pago ${index + 1}`,
      active: true
    }));
    const fake = createFakeSupabase({
      club_teams: [
        {
          id: teamId,
          club_id: clubId,
          name: "La Quinta F5",
          short_name: "LQ5",
          modality: "5v5",
          active: true
        }
      ],
      club_competitions: [
        {
          id: competitionId,
          club_id: clubId,
          name: "LAFAB",
          slug: "lafab",
          active: true
        }
      ],
      club_players: players
    });
    createSupabaseServerClientMock.mockResolvedValue(fake.client);

    const formData = new FormData();
    formData.set("teamId", teamId);
    formData.set("competitionId", competitionId);
    formData.set("modality", "5v5");
    formData.set("playedDate", "2026-05-01");
    formData.set("playedTime", "20:00");
    formData.set("opponentName", "Rival Pagos");
    formData.set("venue", "Complejo Norte");
    formData.set("goalsFor", "2");
    formData.set("goalsAgainst", "1");
    formData.set("fieldCostAmount", "100");
    formData.set("notes", "");

    const paymentStatuses = ["paid", "unpaid", "partial", "paid", "unpaid"];
    for (const [index, player] of players.entries()) {
      formData.set(`playerRole:${player.id}`, "starter");
      formData.set(`playerGoals:${player.id}`, index === 0 ? "2" : "0");
      formData.set(`playerAssists:${player.id}`, "0");
      formData.set(`playerPaymentStatus:${player.id}`, paymentStatuses[index]);
      if (paymentStatuses[index] === "partial") {
        formData.set(`playerPaidAmount:${player.id}`, "12");
      }
    }

    await expect(addClubMatchAction(clubId, formData)).rejects.toMatchObject({
      digest: expect.stringContaining(`/admin/clubs/${clubId}?tab=matches`)
    });

    const match = fake.find("club_matches", (row) => row.opponent_name === "Rival Pagos");
    expect(match).toMatchObject({
      field_cost_cents: 10000,
      field_cost_currency: "ARS"
    });

    const lineups = fake.table("club_match_lineups").filter((row) => row.match_id === match?.id);
    const payments = fake.table("club_match_payments").filter((row) => row.match_id === match?.id);
    expect(payments).toHaveLength(5);
    expect(payments.reduce((total, row) => total + Number(row.expected_cents), 0)).toBe(10000);

    const paymentByName = new Map(
      lineups.map((lineup) => [
        String(lineup.display_name),
        payments.find((payment) => payment.lineup_id === lineup.id)
      ])
    );

    expect(paymentByName.get("Jugador Pago 1")).toMatchObject({
      expected_cents: 2000,
      paid_cents: 2000
    });
    expect(paymentByName.get("Jugador Pago 2")).toMatchObject({
      expected_cents: 2000,
      paid_cents: 0,
      paid_at: null
    });
    expect(paymentByName.get("Jugador Pago 3")).toMatchObject({
      expected_cents: 2000,
      paid_cents: 1200
    });
  });

  it("crea convocatorias con pago estimado desde costo de cancha dividido por ideal", async () => {
    const fake = createFakeSupabase({
      club_teams: [
        {
          id: teamId,
          club_id: clubId,
          name: "La Quinta F7",
          short_name: "LQ7",
          modality: "7v7",
          active: true
        }
      ]
    });
    createSupabaseServerClientMock.mockResolvedValue(fake.client);

    const formData = new FormData();
    formData.set("teamId", teamId);
    formData.set("scheduledDate", "2026-05-20");
    formData.set("scheduledTime", "20:00");
    formData.set("opponentName", "Rival");
    formData.set("venue", "Complejo Sur");
    formData.set("fieldCostAmount", "36000");
    formData.set("idealPlayerCount", "14");
    formData.set("maxPlayerCount", "16");
    formData.set("notes", "");

    await expect(addClubCallupAction(clubId, formData)).rejects.toMatchObject({
      digest: expect.stringContaining(`/admin/clubs/${clubId}?tab=callups`)
    });

    const callup = fake.find("club_callups", (row) => row.club_team_id === teamId);
    expect(callup).toMatchObject({
      field_cost_cents: 3600000,
      full_payment_cents: 257143,
      ideal_player_count: 14,
      target_payment_count: 14
    });
  });

  it("agrega invitados temporales solo a la convocatoria", async () => {
    const callupId = "00000000-0000-4000-8000-000000000700";
    const fake = createFakeSupabase({
      club_callups: [
        {
          id: callupId,
          club_id: clubId,
          club_team_id: teamId,
          scheduled_at: "2026-05-20T23:00:00.000Z",
          ideal_player_count: 14,
          max_player_count: 16,
          target_payment_count: 14,
          full_payment_cents: 257143,
          field_cost_cents: 3600000,
          created_by: "00000000-0000-4000-8000-000000000001"
        }
      ]
    });
    createSupabaseServerClientMock.mockResolvedValue(fake.client);

    const formData = new FormData();
    formData.set("callupId", callupId);
    formData.set("guestName", "Invitado Semanal");
    formData.set("position", "delantero");
    formData.set("paymentStatus", "unpaid");
    formData.set("notes", "Viene por esta fecha");

    await expect(addClubCallupGuestAction(clubId, formData)).rejects.toMatchObject({
      digest: expect.stringContaining(`/admin/clubs/${clubId}?tab=callups&callupId=${callupId}`)
    });

    expect(fake.table("club_players")).toHaveLength(0);
    expect(fake.find("club_callup_guests", (row) => row.callup_id === callupId)).toMatchObject({
      guest_name: "Invitado Semanal",
      position: "delantero",
      expected_cents: 0,
      notes: "Viene por esta fecha"
    });
  });
});
