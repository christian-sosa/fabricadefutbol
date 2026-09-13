import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createSupabaseServerClientMock,
  redirectMock,
  revalidatePathMock,
  confirmTeamOptionMock,
  refreshOrganizationPublicSnapshotSafeMock,
  saveMatchResultMock
} = vi.hoisted(() => ({
  createSupabaseServerClientMock: vi.fn(),
  redirectMock: vi.fn((url: string) => {
    const error = new Error(`NEXT_REDIRECT: ${url}`) as Error & { digest: string; url: string };
    error.digest = `NEXT_REDIRECT;replace;${url};false`;
    error.url = url;
    throw error;
  }),
  revalidatePathMock: vi.fn(),
  confirmTeamOptionMock: vi.fn(),
  refreshOrganizationPublicSnapshotSafeMock: vi.fn(),
  saveMatchResultMock: vi.fn()
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

vi.mock("@/lib/domain/match-workflow", () => ({
  confirmTeamOption: confirmTeamOptionMock,
  regenerateDraftTeamOptions: vi.fn(),
  saveConfirmedMatchLineup: vi.fn(),
  saveMatchResult: saveMatchResultMock
}));

import { confirmOptionAction, saveResultAction, updateMatchAction } from "@/app/admin/(panel)/matches/[id]/actions";
import { createFakeSupabase } from "../helpers/fake-supabase";

describe("admin match result actions", () => {
  beforeEach(() => {
    createSupabaseServerClientMock.mockResolvedValue({ from: vi.fn() });
    redirectMock.mockClear();
    revalidatePathMock.mockClear();
    refreshOrganizationPublicSnapshotSafeMock.mockClear();
    confirmTeamOptionMock.mockClear();
    confirmTeamOptionMock.mockResolvedValue(undefined);
    saveMatchResultMock.mockClear();
    saveMatchResultMock.mockResolvedValue({ firstFinished: true, resultVersion: 1, seasonId: "season-1" });
  });

  it("redirige al partido publico despues de confirmar una opcion", async () => {
    const formData = new FormData();
    formData.set("optionId", "00000000-0000-4000-8000-000000000101");
    formData.set("teamALabel", "Los Pibes");
    formData.set("teamBLabel", "Veteranos");

    await expect(confirmOptionAction("match-1", "org-1", formData)).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT")
    });

    const redirectedTo = redirectMock.mock.calls.at(-1)?.[0];
    expect(typeof redirectedTo).toBe("string");
    const redirectUrl = new URL(String(redirectedTo), "http://localhost");

    expect(redirectUrl.pathname).toBe("/matches/match-1");
    expect(redirectUrl.searchParams.get("org")).toBe("la-banda");
    expect(String(redirectedTo)).not.toContain("/admin/matches/match-1");
    expect(confirmTeamOptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        matchId: "match-1",
        organizationId: "org-1",
        teamALabel: "Los Pibes",
        teamBLabel: "Veteranos"
      })
    );
  });

  it("vuelve al listado editable de partidos despues de cargar un resultado", async () => {
    const formData = new FormData();
    formData.set("scoreA", "3");
    formData.set("scoreB", "2");
    formData.set("notes", "");
    formData.set("mvpParticipantId", "");
    formData.set("lineupPayload", "");

    await expect(saveResultAction("match-1", "org-1", formData)).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT")
    });

    const redirectedTo = redirectMock.mock.calls.at(-1)?.[0];
    expect(typeof redirectedTo).toBe("string");
    const redirectUrl = new URL(String(redirectedTo), "http://localhost");

    expect(redirectUrl.pathname).toBe("/admin/matches");
    expect(redirectUrl.searchParams.get("org")).toBe("la-banda");
    expect(redirectUrl.searchParams.get("view")).toBe("edit");
    expect(redirectUrl.searchParams.get("success")).toBe("Resultado guardado.");
    expect(String(redirectedTo)).not.toContain("/admin/matches/match-1");
    expect(saveMatchResultMock).toHaveBeenCalledWith(
      expect.objectContaining({
        matchId: "match-1",
        organizationId: "org-1"
      })
    );
    expect(refreshOrganizationPublicSnapshotSafeMock).toHaveBeenCalledWith("org-1");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/matches");
  });

  function matchDateFixture(status = "finished", seasonId: string | null = "season-1") {
    const fake = createFakeSupabase({
      matches: [{ id: "match-1", organization_id: "org-1", status, season_id: seasonId,
        scheduled_at: "2026-09-13T22:00:00.000Z", location: "Cancha vieja", result_version: 1 }],
      organization_seasons: [{ id: "season-1", organization_id: "org-1", starts_at: "2026-07-01", ends_at: "2027-06-30" }]
    });
    createSupabaseServerClientMock.mockResolvedValue(fake.client);
    return fake;
  }

  async function changeMatchDate(date: string) {
    const formData = new FormData();
    formData.set("scheduledDate", date);
    formData.set("scheduledTime", "01:30");
    formData.set("location", "Cancha nueva");
    await expect(updateMatchAction("match-1", "org-1", formData)).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT")
    });
    return new URL(String(redirectMock.mock.calls.at(-1)?.[0]), "http://localhost");
  }

  it.each(["2026-06-30", "2027-07-01"])("no mueve un finalizado fuera de su temporada: %s", async (date) => {
    const fake = matchDateFixture();
    const url = await changeMatchDate(date);
    expect(url.searchParams.get("error")).toBe("La fecha de un partido finalizado debe quedar en la misma temporada.");
    expect(fake.table("matches")[0]).toMatchObject({scheduled_at: "2026-09-13T22:00:00.000Z", location: "Cancha vieja"});
    expect(refreshOrganizationPublicSnapshotSafeMock).not.toHaveBeenCalled();
  });

  it.each(["2026-07-01", "2027-01-01", "2027-06-30"])("permite cambiar fecha y hora dentro del intervalo inclusivo: %s", async (date) => {
    const fake = matchDateFixture();
    const url = await changeMatchDate(date);
    expect(url.searchParams.has("error")).toBe(false);
    expect(fake.table("matches")[0]).toMatchObject({scheduled_at: `${date}T01:30:00.000Z`, location: "Cancha nueva", season_id: "season-1"});
  });

  it("conserva la fecha al cambiar solo la hora y protege el año de partidos antiguos sin temporada", async () => {
    const fake = matchDateFixture("finished", null);
    expect((await changeMatchDate("")).searchParams.has("error")).toBe(false);
    expect(fake.table("matches")[0]).toMatchObject({scheduled_at: "2026-09-13T01:30:00.000Z"});
    expect((await changeMatchDate("2027-01-01")).searchParams.get("error")).toBe("La fecha de un partido finalizado debe quedar en la misma temporada.");
  });

  it("no mueve la fecha si otra pestaña termina el partido entre la lectura y la actualización", async () => {
    const fake = matchDateFixture("confirmed", null);
    let matchReads = 0;
    createSupabaseServerClientMock.mockResolvedValue({
      ...fake.client,
      from(table: Parameters<typeof fake.client.from>[0]) {
        if (table === "matches" && ++matchReads === 2) {
          void fake.client.from("matches").update({status: "finished", result_version: 2}).eq("id", "match-1").select("id").maybeSingle();
        }
        return fake.client.from(table);
      }
    });
    const url = await changeMatchDate("2027-01-01");
    expect(url.searchParams.get("error")).toContain("El partido cambio mientras lo editabas");
    expect(fake.table("matches")[0]).toMatchObject({status: "finished", scheduled_at: "2026-09-13T22:00:00.000Z"});
    expect(refreshOrganizationPublicSnapshotSafeMock).not.toHaveBeenCalled();
  });
});
