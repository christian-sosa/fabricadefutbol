import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { purgeExpiredOrganizationPlayerPhotos } from "@/lib/domain/organization-photo-retention";
import { createFakeSupabase } from "../helpers/fake-supabase";

const OLD = "2025-01-01T00:00:00.000Z";
const NOW = "2026-05-20T12:00:00.000Z";
const VERSION = "10000000-0000-4000-8000-000000000001";
const PATH = `app_dev/org-1/player-1/${VERSION}.webp`;
function setup(options: { createdAt?: string; photoAt?: string; path?: string | null; purgedAt?: string | null } = {}) {
  const fake = createFakeSupabase({
    organizations: [{ id: "org-1", created_at: options.createdAt ?? OLD, updated_at: OLD, archived_at: null, image_path: "cover.webp", player_photos_purge_at: null, player_photos_purged_at: options.purgedAt ?? null }],
    organization_public_snapshots: [{ organization_id: "org-1", summary: {}, standings: [], match_history: [] }],
    players: [{ id: "player-1", organization_id: "org-1", created_at: OLD, updated_at: OLD, photo_path: options.path === undefined ? PATH : options.path, photo_updated_at: options.photoAt ?? OLD }],
    player_photo_upload_events: [{ id: "event-1", uploader_id: "admin-1", uploader_role: "organization_admin", target_type: "organization_player", target_player_id: "player-1", created_at: options.photoAt ?? OLD }]
  });
  const remove = vi.fn(async (paths: string[]) => ({ data: paths.map((name) => ({ name })), error: null as { message: string } | null }));
  const rpc = vi.fn(async (_name: string, args: { p_player_id: string; p_expected_path: string }) => {
    const player = fake.table("players").find((row) => row.id === args.p_player_id);
    if (player?.photo_path !== args.p_expected_path) return { data: false, error: null as { message: string } | null };
    await fake.client.from("players").update({ photo_path: null }).eq("id", args.p_player_id);
    await fake.client.from("player_photo_upload_events").delete().eq("target_player_id", args.p_player_id);
    return { data: true, error: null as { message: string } | null };
  });
  const run = () => purgeExpiredOrganizationPlayerPhotos({ supabase: { ...fake.client, rpc, storage: { from: () => ({ remove }) } } as never, bucketName: "player-photos-dev", schemaName: "app_dev", now: new Date(NOW) });
  return { fake, remove, rpc, run };
}
describe("organization photo retention", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(NOW)); });
  afterEach(() => vi.useRealTimers());

  it("programa una sola vez sin alternar fecha y null ni usar updated_at del cron", async () => {
    const { run, fake, remove } = setup({ createdAt: "2026-03-25T00:00:00.000Z" });
    expect((await run()).scheduledOrganizations).toBe(1);
    const before = fake.table("organizations")[0];
    expect((await run()).scheduledOrganizations).toBe(0);
    expect((await run()).resetOrganizations).toBe(0);
    expect(fake.table("organizations")[0]).toEqual(before);
    expect(before.player_photos_purge_at).toBe("2026-09-21T00:00:00.000Z");
    expect(remove).not.toHaveBeenCalled();
  });

  it("borra sólo fotos registradas vencidas y conserva portada/datos deportivos", async () => {
    const { run, fake, remove, rpc } = setup();
    expect(await run()).toMatchObject({ purgedOrganizations: 1, deletedPlayerPhotos: 1 });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("retire_group_player_photo", expect.objectContaining({ p_expected_path: PATH }));
    expect(fake.table("players")[0]).toMatchObject({ id: "player-1", photo_path: null, photo_updated_at: OLD, updated_at: OLD });
    expect(fake.table("organizations")[0].image_path).toBe("cover.webp");
    expect(fake.table("player_photo_upload_events")).toEqual([]);
    expect(fake.table("organization_public_snapshots")).toEqual([]);
    expect((await run()).purgedOrganizations).toBe(0);
    expect(remove).not.toHaveBeenCalled();
  });

  it("una foto cargada hoy renueva la actividad aunque el grupo sea antiguo", async () => {
    const { run, fake, remove } = setup({ photoAt: NOW });
    expect((await run()).purgedOrganizations).toBe(0);
    expect(Date.parse(String(fake.table("organizations")[0].player_photos_purge_at))).toBeGreaterThan(Date.parse(NOW));
    expect(remove).not.toHaveBeenCalled();
  });

  it("considera la actividad de jugadores posteriores a la primera página", async () => {
    const { run, fake, remove } = setup();
    await fake.client.from("players").insert(Array.from({ length: 1001 }, (_, index) => ({
      id: `z-player-${String(index).padStart(4, "0")}`,
      organization_id: "org-1",
      created_at: OLD,
      updated_at: OLD,
      photo_path: null,
      photo_updated_at: index === 1000 ? NOW : OLD
    })));
    expect((await run()).purgedOrganizations).toBe(0);
    expect(remove).not.toHaveBeenCalled();
  });

  it("reactiva la retención después de una purga cuando se vuelve a subir", async () => {
    const { run, fake } = setup({ photoAt: NOW, purgedAt: "2026-04-01T00:00:00Z" });
    expect((await run()).resetOrganizations).toBe(1);
    expect(fake.table("organizations")[0].player_photos_purged_at).toBeNull();
    expect((await run()).resetOrganizations).toBe(0);
  });

  it("no busca objetos en Storage para jugadores sin foto", async () => {
    const { run, remove } = setup({ path: null });
    expect((await run()).deletedPlayerPhotos).toBe(0);
    expect(remove).not.toHaveBeenCalled();
  });

  it("no marca una purga completa si falla la transaccion de metadata y cola", async () => {
    const { run, fake, rpc } = setup();
    rpc.mockResolvedValueOnce({ data: false, error: { message: "fallo de transaccion" } });
    await expect(run()).rejects.toThrow("fallo de transaccion");
    expect(fake.table("players")[0].photo_path).toBe(PATH);
    expect(fake.table("organizations")[0].player_photos_purged_at).toBeNull();
  });

  it("preserva una versión nueva subida mientras se elimina la versión vencida", async () => {
    const { run, fake, remove, rpc } = setup();
    const newPath = "app_dev/org-1/player-1/20000000-0000-4000-8000-000000000002.webp";
    rpc.mockImplementationOnce(async () => {
      await fake.client.from("players").update({ photo_path: newPath, photo_updated_at: NOW }).eq("id", "player-1");
      return { data: false, error: null };
    });
    await run();
    expect(remove).not.toHaveBeenCalled();
    expect(fake.table("players")[0].photo_path).toBe(newPath);
    await run();
    expect(remove).not.toHaveBeenCalled();
  });
});
