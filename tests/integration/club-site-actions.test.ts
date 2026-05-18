import { describe, expect, it, vi } from "vitest";

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

vi.mock("@/lib/auth/clubs", () => ({
  assertClubWriteAction: vi.fn(async () => ({
    userId: "00000000-0000-4000-8000-000000000001",
    email: "admin@example.com",
    displayName: "Admin",
    isSuperAdmin: false
  })),
  getClubSlugById: vi.fn(async () => "la-quinta")
}));

vi.mock("@/lib/queries/clubs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/queries/clubs")>();
  return {
    ...actual,
    refreshClubPublicSnapshot: vi.fn()
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock
}));

import {
  addClubProductAction,
  updateClubSiteSettingsAction
} from "@/app/admin/(panel)/clubs/[clubId]/actions";
import { createFakeSupabase } from "../helpers/fake-supabase";

const clubId = "00000000-0000-4000-8000-000000000100";

describe("club site admin actions", () => {
  it("guarda configuracion del sitio del club con secciones visibles", async () => {
    const fake = createFakeSupabase();
    createSupabaseServerClientMock.mockResolvedValue(fake.client);

    const formData = new FormData();
    formData.set("enabled", "on");
    formData.set("published", "on");
    formData.set("domain", " laquinta.com.ar ");
    formData.set("primaryColor", "#ff9900");
    formData.set("secondaryColor", "#0a0908");
    formData.set("accentColor", "#25D366");
    formData.set("fontFamily", "oswald");
    formData.set("whatsappUrlOrPhone", "5491112345678");
    formData.set("instagramUrl", "https://instagram.com/laquintafc");
    formData.set("section:catalog", "on");
    formData.set("section:teamData", "on");
    formData.set("section:matches", "on");

    await expect(updateClubSiteSettingsAction(clubId, formData)).rejects.toMatchObject({
      digest: expect.stringContaining(`/admin/clubs/${clubId}?tab=site`)
    });

    expect(fake.find("club_site_settings", (row) => row.club_id === clubId)).toMatchObject({
      club_id: clubId,
      enabled: true,
      published: true,
      domain: "laquinta.com.ar",
      primary_color: "#ff9900",
      secondary_color: "#0a0908",
      accent_color: "#25D366",
      font_family: "oswald",
      whatsapp_url_or_phone: "5491112345678",
      instagram_url: "https://instagram.com/laquintafc",
      section_visibility: expect.objectContaining({
        catalog: true,
        teamData: true,
        activity: false,
        teams: false,
        matches: true
      })
    });
  });

  it("crea productos de catalogo sin venta directa y con slug unico", async () => {
    const fake = createFakeSupabase({
      club_products: [
        {
          id: "00000000-0000-4000-8000-000000000201",
          club_id: clubId,
          name: "Camiseta Titular 2026",
          slug: "camiseta-titular-2026",
          visible: true,
          status: "available",
          sort_order: 1
        }
      ]
    });
    createSupabaseServerClientMock.mockResolvedValue(fake.client);

    const formData = new FormData();
    formData.set("name", "Camiseta Titular 2026");
    formData.set("description", "Nueva piel oficial del club.");
    formData.set("category", "Camisetas");
    formData.set("priceLabel", "Consultar precio");
    formData.set("status", "available");
    formData.set("visible", "on");
    formData.set("sortOrder", "2");
    formData.set("contactChannel", "whatsapp");
    formData.set("contactMessage", "Hola La Quinta, quiero consultar por la camiseta 2026.");

    await expect(addClubProductAction(clubId, formData)).rejects.toMatchObject({
      digest: expect.stringContaining(`/admin/clubs/${clubId}?tab=site`)
    });

    expect(fake.find("club_products", (row) => row.slug === "camiseta-titular-2026-2")).toMatchObject({
      club_id: clubId,
      name: "Camiseta Titular 2026",
      category: "Camisetas",
      price_label: "Consultar precio",
      visible: true,
      status: "available",
      sort_order: 2,
      contact_channel: "whatsapp",
      contact_url: null
    });
  });
});
