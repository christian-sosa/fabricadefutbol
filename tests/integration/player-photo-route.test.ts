import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ client: vi.fn(), sign: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.client }));
vi.mock("@/lib/env", () => ({ getSupabaseDbSchema: () => "app_dev", getPlayerPhotosBucket: () => "player-photos-dev" }));
vi.mock("@/lib/storage-image-responses", () => ({ createSignedStorageRedirect: mocks.sign }));
import { GET } from "@/app/api/player-photo/[id]/route";
const ID = "10000000-0000-4000-8000-000000000001";
function setup(photoPath: string | null) {
  const single = vi.fn().mockResolvedValue({ data: { organization_id: "org-1", photo_path: photoPath }, error: null });
  const eq = vi.fn(() => ({ maybeSingle: single }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  mocks.client.mockResolvedValue({ from });
  return { from, select, single };
}
const get = (id = ID) => GET(new Request("https://example.test/api/player-photo/" + id), { params: Promise.resolve({ id }) });
describe("player photo route", () => {
  beforeEach(() => vi.resetAllMocks());
  it("descarta IDs inválidos sin DB ni Storage", async () => {
    const response = await get("bad");
    expect(response.headers.get("location")).toBe("https://example.test/avatar-placeholder.svg");
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("devuelve placeholder con una sola consulta y cero Storage si no hay metadata", async () => {
    const { from } = setup(null);
    const response = await get();
    expect(from).toHaveBeenCalledExactlyOnceWith("players");
    expect(mocks.sign).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toContain("avatar-placeholder.svg");
  });
  it("firma únicamente el objeto registrado sin descargar ni probar alternativas", async () => {
    const path = `app_dev/org-1/${ID}/20000000-0000-4000-8000-000000000002.webp`;
    setup(path);
    mocks.sign.mockResolvedValue(new Response(null, { status: 307, headers: { location: "https://storage.test/signed" } }));
    const response = await get();
    expect(mocks.sign).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ objectPath: path }));
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it("no firma paths pertenecientes a otro jugador", async () => {
    setup("app_dev/org-1/another-player.webp");
    await get();
    expect(mocks.sign).not.toHaveBeenCalled();
  });
});
