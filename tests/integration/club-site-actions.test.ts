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

const { optimizeClubProductImageMock } = vi.hoisted(() => ({
  optimizeClubProductImageMock: vi.fn(async () => Buffer.from("optimized-product-image"))
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

vi.mock("@/lib/club-site-media", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/club-site-media")>();
  return {
    ...actual,
    optimizeClubProductImage: optimizeClubProductImageMock
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock
}));

import {
  addClubProductAction,
  deleteClubProductAction,
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

  it("permite crear un producto con imagen inicial", async () => {
    const fake = createFakeSupabase();
    const uploadedObjects: Array<{ bucket: string; path: string; contentType?: string }> = [];
    createSupabaseServerClientMock.mockResolvedValue({
      ...fake.client,
      storage: {
        from: (bucket: string) => ({
          upload: async (path: string, _body: unknown, options?: { contentType?: string }) => {
            uploadedObjects.push({ bucket, path, contentType: options?.contentType });
            return { data: { path }, error: null };
          }
        })
      }
    });

    const formData = new FormData();
    formData.set("name", "Campera concentracion");
    formData.set("description", "Abrigo oficial para previa y viajes.");
    formData.set("category", "Indumentaria");
    formData.set("priceLabel", "Consultar precio");
    formData.set("status", "available");
    formData.set("visible", "on");
    formData.set("sortOrder", "3");
    formData.set("contactChannel", "whatsapp");
    formData.set("productImage", new File(["image"], "campera.png", { type: "image/png" }));

    await expect(addClubProductAction(clubId, formData)).rejects.toMatchObject({
      digest: expect.stringContaining(`/admin/clubs/${clubId}?tab=site`)
    });

    const product = fake.find("club_products", (row) => row.name === "Campera concentracion");
    expect(product?.image_path).toBe(`public/clubs/${clubId}/products/${product?.id}.webp`);
    expect(uploadedObjects).toEqual([
      {
        bucket: "club-site-media",
        path: `public/clubs/${clubId}/products/${product?.id}.webp`,
        contentType: "image/webp"
      }
    ]);
    expect(optimizeClubProductImageMock).toHaveBeenCalledWith(expect.any(File));
  });

  it("elimina productos cargados y limpia su imagen", async () => {
    const productId = "00000000-0000-4000-8000-000000000301";
    const imagePath = `public/clubs/${clubId}/products/${productId}.webp`;
    const fake = createFakeSupabase({
      club_products: [
        {
          id: productId,
          club_id: clubId,
          image_path: imagePath,
          name: "Camiseta suplente",
          slug: "camiseta-suplente",
          status: "available",
          visible: true
        }
      ]
    });
    const removedObjects: Array<{ bucket: string; paths: string[] }> = [];
    createSupabaseServerClientMock.mockResolvedValue({
      ...fake.client,
      storage: {
        from: (bucket: string) => ({
          remove: async (paths: string[]) => {
            removedObjects.push({ bucket, paths });
            return { data: [], error: null };
          }
        })
      }
    });

    const formData = new FormData();
    formData.set("productId", productId);

    await expect(deleteClubProductAction(clubId, formData)).rejects.toMatchObject({
      digest: expect.stringContaining(`/admin/clubs/${clubId}?tab=site`)
    });

    expect(fake.find("club_products", (row) => row.id === productId)).toBeNull();
    expect(removedObjects).toEqual([{ bucket: "club-site-media", paths: [imagePath] }]);
  });
});
