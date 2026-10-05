import { beforeEach, describe, expect, it, vi } from "vitest";

const { createSupabaseServerClientMock, redirectMock, revalidatePathMock } = vi.hoisted(() => ({
  createSupabaseServerClientMock: vi.fn(),
  redirectMock: vi.fn((url: string) => {
    const error = new Error(`NEXT_REDIRECT: ${url}`) as Error & { digest: string; url: string };
    error.digest = `NEXT_REDIRECT;replace;${url};false`;
    error.url = url;
    throw error;
  }),
  revalidatePathMock: vi.fn()
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
  refreshOrganizationPublicSnapshotSafe: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock
}));
vi.mock("@/lib/env", () => ({ getPlayerPhotosBucket: () => "player-photos", getSupabaseDbSchema: () => "app_dev" }));
vi.mock("@/lib/domain/media-cleanup", () => ({ enqueueMediaCleanup: vi.fn() }));
vi.mock("@/lib/player-photos", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/player-photos")>(),
  optimizePlayerAvatarImage: vi.fn(async () => Buffer.from("webp"))
}));

import { bulkCreatePlayersAction, bulkUpdatePlayersAction, createPlayerAction, deletePlayerAction, setPlayerInjuryAction, uploadPlayerPhotoAction } from "@/app/admin/(panel)/players/actions";
import { assertOrganizationAdminAction } from "@/lib/auth/admin";
import { refreshOrganizationPublicSnapshotSafe } from "@/lib/queries/public";
import { createFakeSupabase } from "../helpers/fake-supabase";

beforeEach(() => { vi.clearAllMocks(); });

describe("admin players actions", () => {
  const organizationId = "00000000-0000-4000-8000-000000000001";
  const playerId = "00000000-0000-4000-8000-000000000002";
  const otherPlayerId = "00000000-0000-4000-8000-000000000003";
  const otherOrganizationId = "00000000-0000-4000-8000-000000000004";

  function removalForm() {
    const form = new FormData();
    form.set("organizationId", organizationId);
    form.set("deletePlayerId", playerId);
    return form;
  }

  it.each(["archived", "removed"])("informa la baja %s y refresca plantel, ranking e historial", async (disposition) => {
    const fake = createFakeSupabase({ players: [{ id: playerId, organization_id: organizationId, full_name: "Ana Pérez", active: true }] });
    const rpc = vi.fn().mockResolvedValue({ data: { disposition }, error: null });
    createSupabaseServerClientMock.mockResolvedValue({ ...fake.client, rpc });
    await expect(deletePlayerAction(removalForm())).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
    expect(rpc).toHaveBeenCalledWith("delete_group_player", { p_player_id: playerId, p_organization_id: organizationId });
    const destination = new URL(redirectMock.mock.calls.at(-1)![0], "https://local.invalid");
    expect(destination.searchParams.get("success")).toContain("Ana Pérez fue quitado del plantel.");
    expect(destination.searchParams.get("success")?.includes("estadísticas se conservaron")).toBe(disposition === "archived");
    expect(destination.searchParams.get("view")).toBe("edit");
    expect(refreshOrganizationPublicSnapshotSafe).toHaveBeenCalledWith(organizationId);
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/matches/new");
    expect(revalidatePathMock).toHaveBeenCalledWith(`/players/${playerId}`);
    expect(revalidatePathMock).toHaveBeenCalledWith("/matches", "layout");
  });

  it("explica cómo resolver una convocatoria pendiente sin anunciar una baja", async () => {
    const fake = createFakeSupabase({ players: [{ id: playerId, organization_id: organizationId, full_name: "Ana Pérez" }] });
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: "PT409", message: "Partido pendiente" } });
    createSupabaseServerClientMock.mockResolvedValue({ ...fake.client, rpc });
    await expect(deletePlayerAction(removalForm())).rejects.toMatchObject({ digest: expect.stringContaining("error=") });
    const destination = new URL(redirectMock.mock.calls.at(-1)![0], "https://local.invalid");
    expect(destination.searchParams.get("error")).toContain("Quitalo de la convocatoria");
    expect(destination.searchParams.has("success")).toBe(false);
    expect(refreshOrganizationPublicSnapshotSafe).not.toHaveBeenCalled();
  });

  it("reintenta una baja completada consultando la RPC autorizada", async () => {
    const fake = createFakeSupabase({ players: [] });
    const rpc = vi.fn().mockResolvedValue({ data: { disposition: "removed", alreadyRemoved: true }, error: null });
    createSupabaseServerClientMock.mockResolvedValue({ ...fake.client, rpc });
    await expect(deletePlayerAction(removalForm())).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
    const destination = new URL(redirectMock.mock.calls.at(-1)![0], "https://local.invalid");
    expect(destination.searchParams.get("success")).toBe("El jugador ya no está en el plantel.");
    expect(assertOrganizationAdminAction).toHaveBeenCalledWith(organizationId);
    expect(rpc).toHaveBeenCalledOnce();
  });

  function injuryForm(value: string | null = "true", id = playerId) {
    const form = new FormData();
    form.set("organizationId", organizationId);
    form.set("playerId", id);
    if (value !== null) form.set("isInjured", value);
    return form;
  }

  function photoForm() {
    const form = new FormData();
    form.set("organizationId", organizationId); form.set("playerId", playerId);
    form.set("photo", new File(["image"], "ana.webp", { type: "image/webp" }));
    return form;
  }

  function photoClient(fake: ReturnType<typeof createFakeSupabase>, upload: ReturnType<typeof vi.fn>, failure?: "reserve" | "finalize" | "cancel") {
    const reservations = new Map<string, { path: string; playerId: string }>();
    const rpc = vi.fn(async (name: string, args: Record<string, string>) => {
      if (name === `reserve_group_player_photo` && failure === "reserve") return { data: null, error: { message: "Ya alcanzaste el limite de 2 reemplazos para este jugador." } };
      if (name === "reserve_group_player_photo") {
        const path = `app_dev/${args.p_organization_id}/${args.p_player_id}/${args.p_revision}.webp`;
        reservations.set(args.p_revision, { path, playerId: args.p_player_id });
        return { data: { path, reservation_id: args.p_revision, expires_at: "2026-10-01T00:00:00Z" }, error: null };
      }
      if (name === "finalize_group_player_photo") {
        if (failure === "finalize") return { data: null, error: { message: "El jugador cambió mientras subías." } };
        const reservation = reservations.get(args.p_reservation_id)!;
        const previous = fake.find("players", (row) => row.id === reservation.playerId)?.photo_path ?? null;
        await fake.client.from("players").update({ photo_path: reservation.path, photo_updated_at: "2026-09-30T00:00:00Z" }).eq("id", reservation.playerId);
        return { data: { path: reservation.path, updated_at: "2026-09-30T00:00:00Z", previous_path: previous }, error: null };
      }
      if (name === "cancel_group_player_photo") return { data: true, error: failure === "cancel" ? { message: "Cancellation unavailable" } : null };
      return fake.client.rpc(name, args);
    });
    const client = { ...fake.client, rpc, storage: { from: () => ({ upload }) } };
    createSupabaseServerClientMock.mockResolvedValue(client);
    return rpc;
  }

  it("guarda y recupera una lesión de forma idempotente sin cambiar puntos ni otros jugadores", async () => {
    const fake = createFakeSupabase({ players: [
      { id: playerId, organization_id: organizationId, full_name: "Ana Pérez", is_injured: false, current_rating: 1175, skill_level: 3, active: true },
      { id: otherPlayerId, organization_id: organizationId, is_injured: true, current_rating: 1100 }
    ] });
    createSupabaseServerClientMock.mockResolvedValue(fake.client);

    for (const value of ["true", "true", "false", "false"]) {
      await expect(setPlayerInjuryAction(injuryForm(value))).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
      expect(fake.find("players", (row) => row.id === playerId)).toMatchObject({
        is_injured: value === "true", full_name: "Ana Pérez", current_rating: 1175, skill_level: 3, active: true
      });
      expect(fake.find("players", (row) => row.id === otherPlayerId)?.is_injured).toBe(true);
      const destination = new URL(redirectMock.mock.calls.at(-1)![0], "https://local.invalid");
      expect(destination.searchParams.has("error")).toBe(false);
      expect(destination.searchParams.get("success")).toBeTruthy();
      expect(destination.searchParams.get("org")).toBe("la-banda");
      expect(destination.searchParams.get("view")).toBe("edit");
      expect(destination.hash).toBe(`#player-${playerId}`);
    }

    expect(assertOrganizationAdminAction).toHaveBeenCalledWith(organizationId);
    expect(refreshOrganizationPublicSnapshotSafe).toHaveBeenCalledWith(organizationId);
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/players");
    expect(revalidatePathMock).toHaveBeenCalledWith("/ranking");
    expect(revalidatePathMock).toHaveBeenCalledWith(`/players/${playerId}`);
  });

  it.each([null, "", "on", "1", "yes", "FALSE"])("rechaza estado de lesión inválido %s antes de escribir", async (value) => {
    const fake = createFakeSupabase({ players: [{ id: playerId, organization_id: organizationId, is_injured: false }] });
    createSupabaseServerClientMock.mockResolvedValue(fake.client);
    await expect(setPlayerInjuryAction(injuryForm(value))).rejects.toMatchObject({ digest: expect.stringContaining("error=") });
    expect(fake.find("players", (row) => row.id === playerId)?.is_injured).toBe(false);
    expect(createSupabaseServerClientMock).not.toHaveBeenCalled();
  });

  it("no escribe si no tiene permisos de administración", async () => {
    vi.mocked(assertOrganizationAdminAction).mockRejectedValueOnce(new Error("No tenés permisos para editar este grupo."));
    await expect(setPlayerInjuryAction(injuryForm())).rejects.toMatchObject({ digest: expect.stringContaining("error=") });
    expect(createSupabaseServerClientMock).not.toHaveBeenCalled();
    expect(refreshOrganizationPublicSnapshotSafe).not.toHaveBeenCalled();
  });

  it.each(["otro grupo", "eliminado"])("informa que falta el jugador (%s) sin anunciar éxito ni modificar otra organización", async (scenario) => {
    const fake = createFakeSupabase({ players: scenario === "otro grupo"
      ? [{ id: playerId, organization_id: otherOrganizationId, is_injured: false }]
      : [] });
    createSupabaseServerClientMock.mockResolvedValue(fake.client);
    await expect(setPlayerInjuryAction(injuryForm())).rejects.toMatchObject({ digest: expect.stringContaining("error=") });
    expect(fake.find("players", (row) => row.id === playerId)?.is_injured).not.toBe(true);
    expect(refreshOrganizationPublicSnapshotSafe).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("informa un fallo de guardado sin cambiar el estado ni refrescar snapshots", async () => {
    const fake = createFakeSupabase({ players: [{ id: playerId, organization_id: organizationId, is_injured: false }], queryFailures: { players: { update: "Database unavailable" } } });
    createSupabaseServerClientMock.mockResolvedValue(fake.client);
    await expect(setPlayerInjuryAction(injuryForm())).rejects.toMatchObject({ digest: expect.stringContaining("error=") });
    expect(fake.find("players", (row) => row.id === playerId)?.is_injured).toBe(false);
    expect(refreshOrganizationPublicSnapshotSafe).not.toHaveBeenCalled();
  });

  it("conserva un jugador creado tras fallo Storage y reintenta sólo su foto desde la planilla", async () => {
    const organizationId = "00000000-0000-4000-8000-000000000001";
    const fake = createFakeSupabase({ players: [] });
    const upload = vi.fn().mockResolvedValueOnce({ error: { message: "Storage unavailable" } }).mockResolvedValue({ error: null });
    const rpc = photoClient(fake, upload);
    const photo = new File(["image"], "ana.webp", { type: "image/webp" });
    const form = new FormData();
    form.set("organizationId", organizationId); form.set("fullName", "Ana Pérez"); form.set("skillLevel", "4"); form.set("photo", photo);
    await expect(createPlayerAction(form)).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
    const created = fake.table("players")[0];
    expect(fake.table("players")).toHaveLength(1);
    const destination = new URL(redirectMock.mock.calls.at(-1)![0], "https://local.invalid");
    expect(destination.searchParams.get("notice")).toContain("Jugador creado");
    expect(destination.searchParams.has("error")).toBe(false);
    expect(destination.searchParams.get("view")).toBe("edit");
    expect(destination.searchParams.get("photoPlayer")).toBe(created.id);
    expect(destination.hash).toBe(`#player-${created.id}`);
    // Same row receives the next upload; no second create request is needed.
    await fake.client.from("players").update({ photo_path: null }).eq("id", created.id);
    const retry = new FormData();
    retry.set("organizationId", organizationId); retry.set("playerId", String(created.id)); retry.set("photo", photo);
    await expect(uploadPlayerPhotoAction(retry)).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
    expect(fake.table("players")).toHaveLength(1);
    expect(fake.find("players", (row) => row.id === created.id)?.photo_path).toContain(`/${created.id}/`);
    expect(upload).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(["reserve_group_player_photo", "cancel_group_player_photo", "reserve_group_player_photo", "finalize_group_player_photo"]);
  });

  it("reserva antes de subir una revisión inmutable y finaliza sin escrituras directas del acta de foto", async () => {
    const fake = createFakeSupabase({ players: [{ id: playerId, organization_id: organizationId, photo_path: "previous.webp" }] });
    const upload = vi.fn().mockResolvedValue({ error: null });
    const rpc = photoClient(fake, upload);
    await expect(uploadPlayerPhotoAction(photoForm())).rejects.toMatchObject({ digest: expect.stringContaining("success=") });
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(["reserve_group_player_photo", "finalize_group_player_photo"]);
    expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(upload.mock.invocationCallOrder[0]);
    expect(upload.mock.invocationCallOrder[0]).toBeLessThan(rpc.mock.invocationCallOrder[1]);
    expect(upload).toHaveBeenCalledWith(expect.stringContaining(`app_dev/${organizationId}/${playerId}/`), expect.any(Buffer), expect.objectContaining({ upsert: false, contentType: "image/webp" }));
    expect(fake.table("player_photo_upload_events")).toEqual([]);
    expect(revalidatePathMock).toHaveBeenCalledWith(`/api/player-photo/${playerId}`);
  });

  it("rechaza cuota agotada antes de llamar Storage", async () => {
    const fake = createFakeSupabase({ players: [{ id: playerId, organization_id: organizationId, photo_path: "previous.webp" }] });
    const upload = vi.fn();
    const rpc = photoClient(fake, upload, "reserve");
    await expect(uploadPlayerPhotoAction(photoForm())).rejects.toMatchObject({ digest: expect.stringContaining("error=") });
    expect(upload).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(fake.find("players", (row) => row.id === playerId)?.photo_path).toBe("previous.webp");
  });

  it("cancela la reserva ante conflicto final sin reemplazar la foto vigente", async () => {
    const fake = createFakeSupabase({ players: [{ id: playerId, organization_id: organizationId, photo_path: "newer.webp" }] });
    const upload = vi.fn().mockResolvedValue({ error: null });
    const rpc = photoClient(fake, upload, "finalize");
    await expect(uploadPlayerPhotoAction(photoForm())).rejects.toMatchObject({ digest: expect.stringContaining("error=") });
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(["reserve_group_player_photo", "finalize_group_player_photo", "cancel_group_player_photo"]);
    expect(fake.find("players", (row) => row.id === playerId)?.photo_path).toBe("newer.webp");
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("conserva el fallo de Storage aun si cancelar no está disponible", async () => {
    const fake = createFakeSupabase({ players: [{ id: playerId, organization_id: organizationId, photo_path: "previous.webp" }] });
    const upload = vi.fn().mockRejectedValue(new Error("Storage request failed"));
    const rpc = photoClient(fake, upload, "cancel");
    await expect(uploadPlayerPhotoAction(photoForm())).rejects.toMatchObject({ digest: expect.stringContaining(encodeURIComponent("Storage request failed")) });
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(["reserve_group_player_photo", "cancel_group_player_photo"]);
    expect(fake.find("players", (row) => row.id === playerId)?.photo_path).toBe("previous.webp");
  });

  it("cancela una reserva cuya ruta no corresponde al jugador sin subir bytes", async () => {
    const fake = createFakeSupabase({ players: [{ id: playerId, organization_id: organizationId, photo_path: "previous.webp" }] });
    const upload = vi.fn();
    const reservationId = "00000000-0000-4000-8000-000000000090";
    const rpc = vi.fn(async (name: string) => name === "reserve_group_player_photo"
      ? { data: { path: `app_dev/${otherOrganizationId}/${playerId}/${reservationId}.webp`, reservation_id: reservationId, expires_at: "2026-10-01T00:00:00Z" }, error: null }
      : { data: true, error: null });
    createSupabaseServerClientMock.mockResolvedValue({ ...fake.client, rpc, storage: { from: () => ({ upload }) } });
    await expect(uploadPlayerPhotoAction(photoForm())).rejects.toMatchObject({ digest: expect.stringContaining("error=") });
    expect(upload).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenLastCalledWith("cancel_group_player_photo", { p_organization_id: organizationId, p_player_id: playerId, p_reservation_id: reservationId });
    expect(fake.find("players", (row) => row.id === playerId)?.photo_path).toBe("previous.webp");
  });
  it("carga una lista sin duplicar jugadores existentes ni cambiar su nivel", async () => {
    const organizationId = "00000000-0000-4000-8000-000000000001";
    const fake = createFakeSupabase({ players: [{ id: "existing", organization_id: organizationId, full_name: "Juan Pérez", active: true, initial_rank: 3, display_order: 4, skill_level: 2 }] });
    createSupabaseServerClientMock.mockResolvedValue(fake.client);
    const form = new FormData();
    form.set("organizationId", organizationId);
    form.set("names", "juan pérez\nNico López\nNico López\nDiego Ruiz");
    await expect(bulkCreatePlayersAction({ error: null }, form)).rejects.toMatchObject({ digest: expect.stringContaining("view=edit") });
    expect(fake.table("players")).toHaveLength(3);
    expect(fake.find("players", (row) => row.id === "existing")?.skill_level).toBe(2);
    expect(fake.find("players", (row) => row.full_name === "Nico López")).toMatchObject({ organization_id: organizationId, initial_rank: 4, display_order: 5, skill_level: 5 });
  });
  it("rechaza toda la lista inválida antes de escribir", async () => {
    const fake = createFakeSupabase({ players: [] });
    createSupabaseServerClientMock.mockResolvedValue(fake.client);
    const form = new FormData();
    form.set("organizationId", "00000000-0000-4000-8000-000000000001");
    form.set("names", "Juan Pérez\nX");
    expect((await bulkCreatePlayersAction({ error: null }, form)).error).toBeTruthy();
    expect(fake.table("players")).toHaveLength(0);
  });
  it("permite guardar la planilla sin editar rendimiento", async () => {
    const organizationId = "00000000-0000-4000-8000-000000000001";
    const playerId = "00000000-0000-4000-8000-000000000002";
    const fake = createFakeSupabase({
      players: [
        {
          id: playerId,
          organization_id: organizationId,
          full_name: "Juan Perez",
          active: true,
          initial_rank: 1,
          skill_level: 3,
          current_rating: 1175,
          created_at: "2026-04-01T00:00:00.000Z"
        }
      ]
    });
    createSupabaseServerClientMock.mockResolvedValue(fake.client);

    const formData = new FormData();
    formData.set("organizationId", organizationId);
    formData.append("playerId", playerId);
    formData.append("fullName", "Juan Perez actualizado");
    formData.append("skillLevel", "7");

    await expect(bulkUpdatePlayersAction(formData)).rejects.toMatchObject({
      digest: expect.stringContaining("/admin/players?org=la-banda")
    });

    expect(fake.find("players", (row) => row.id === playerId)).toMatchObject({
      full_name: "Juan Perez actualizado",
      skill_level: 7,
      current_rating: 1175
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/players");
  });
});
