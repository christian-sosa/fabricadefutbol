import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ authorize: vi.fn(), client: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw Object.assign(new Error(`REDIRECT:${url}`), { digest: "NEXT_REDIRECT" }); } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/auth/admin", () => ({ assertOrganizationAdminAction: mocks.authorize, getOrganizationQueryKeyById: async () => "viernes" }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.client }));
import { setOrganizationListedAction } from "@/app/admin/(panel)/actions";
import { createFakeSupabase } from "../helpers/fake-supabase";

const id = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
function data(listed: boolean) { const form = new FormData(); form.set("organizationId", id); if (listed) form.set("isListed", "on"); return form; }
describe("visibilidad en el catálogo", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.authorize.mockResolvedValue({ userId: "admin" }); });
  it.each([true, false])("guarda %s sólo para el grupo autorizado y revalida el catálogo", async (listed) => {
    const db = createFakeSupabase({ organizations: [{ id, is_listed: !listed }, { id: otherId, is_listed: !listed }] });
    mocks.client.mockResolvedValue(db.client);
    await expect(setOrganizationListedAction(data(listed))).rejects.toThrow("REDIRECT:/admin?org=viernes&success=");
    expect(mocks.authorize).toHaveBeenCalledWith(id);
    expect(db.find("organizations", (row) => row.id === id)?.is_listed).toBe(listed);
    expect(db.find("organizations", (row) => row.id === otherId)?.is_listed).toBe(!listed);
    expect(mocks.revalidate).toHaveBeenCalledWith("/organizations");
  });
  it("no crea cliente ni modifica grupos cuando falla autorización", async () => {
    mocks.authorize.mockRejectedValue(new Error("No autorizado."));
    await expect(setOrganizationListedAction(data(false))).rejects.toThrow("REDIRECT:/admin?");
    expect(mocks.client).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("devuelve error cuando el grupo desapareció sin anunciar un guardado", async () => {
    mocks.client.mockResolvedValue(createFakeSupabase({ organizations: [] }).client);
    await expect(setOrganizationListedAction(data(false))).rejects.toThrow("No%20se%20pudo%20guardar");
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});
