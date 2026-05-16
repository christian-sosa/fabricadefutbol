import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createSupabaseServerClientMock,
  redirectMock,
  revalidatePathMock,
  refreshOrganizationPublicSnapshotSafeMock
} = vi.hoisted(() => ({
  createSupabaseServerClientMock: vi.fn(),
  redirectMock: vi.fn((url: string) => {
    const error = new Error(`NEXT_REDIRECT: ${url}`) as Error & { digest: string; url: string };
    error.digest = `NEXT_REDIRECT;replace;${url};false`;
    error.url = url;
    throw error;
  }),
  revalidatePathMock: vi.fn(),
  refreshOrganizationPublicSnapshotSafeMock: vi.fn()
}));

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

vi.mock("@/lib/auth/admin", () => ({
  assertOrganizationAdminAction: vi.fn(async () => ({
    userId: "admin-1",
    email: "admin@example.com",
    displayName: "Admin",
    isSuperAdmin: false
  })),
  getOrganizationQueryKeyById: vi.fn(async () => "la-banda")
}));

vi.mock("@/lib/queries/public", () => ({
  refreshOrganizationPublicSnapshotSafe: refreshOrganizationPublicSnapshotSafeMock
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock
}));

import { createMatchAction } from "@/app/admin/(panel)/matches/new/actions";
import { createFakeSupabase } from "../helpers/fake-supabase";

const ORGANIZATION_ID = "00000000-0000-4000-8000-000000000001";

function buildPlayers(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index + 101).padStart(12, "0")}`,
    organization_id: ORGANIZATION_ID,
    full_name: `Jugador ${index + 1}`,
    initial_rank: index + 1,
    skill_level: Math.min(7, Math.floor(index / 2) + 1),
    display_order: index + 1,
    current_rating: 1000,
    active: true
  }));
}

function buildManualMatchForm(playerIds: string[]) {
  const formData = new FormData();
  formData.set("organizationId", ORGANIZATION_ID);
  formData.set("scheduledDate", "2026-05-20");
  formData.set("scheduledTime", "20:00");
  formData.set("modality", "5v5");
  formData.set("location", "Saturno");
  formData.set("creationMode", "manual");
  formData.set("teamALabel", "Los Pibes");
  formData.set("teamBLabel", "Veteranos");
  formData.set(
    "manualAssignmentsPayload",
    JSON.stringify(
      playerIds.map((playerId, index) => ({
        participantId: `player:${playerId}`,
        team: index < 5 ? "A" : "B"
      }))
    )
  );

  for (const playerId of playerIds) {
    formData.append("playerIds", playerId);
  }

  return formData;
}

describe("admin new match actions", () => {
  beforeEach(() => {
    redirectMock.mockClear();
    revalidatePathMock.mockClear();
    refreshOrganizationPublicSnapshotSafeMock.mockClear();
    createSupabaseServerClientMock.mockReset();
  });

  it("crea un partido manual con nombres de equipos y redirige a la pagina publica", async () => {
    const players = buildPlayers(10);
    const fake = createFakeSupabase({
      organizations: [{ id: ORGANIZATION_ID, name: "La Banda", slug: "la-banda" }],
      players
    });
    createSupabaseServerClientMock.mockResolvedValue(fake.client);

    await expect(createMatchAction(buildManualMatchForm(players.map((player) => player.id)))).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT")
    });

    const match = fake.table("matches")[0];
    expect(match).toEqual(
      expect.objectContaining({
        status: "confirmed",
        team_a_label: "Los Pibes",
        team_b_label: "Veteranos"
      })
    );

    const redirectedTo = redirectMock.mock.calls.at(-1)?.[0];
    const redirectUrl = new URL(String(redirectedTo), "http://localhost");
    expect(redirectUrl.pathname).toBe(`/matches/${match.id}`);
    expect(redirectUrl.searchParams.get("org")).toBe("la-banda");
    expect(redirectUrl.searchParams.get("ff_event")).toBe("match_created");
    expect(String(redirectedTo)).not.toContain("/admin/matches");
    expect(refreshOrganizationPublicSnapshotSafeMock).toHaveBeenCalledWith(ORGANIZATION_ID);
  });
});
