import { describe, expect, it } from "vitest";

import {
  buildClubProductContactHref,
  buildClubSitePublicHref,
  filterVisibleClubProducts,
  isClubSiteCustomDomainHost,
  normalizeClubSiteSettings,
  type ClubProductRecord
} from "@/lib/domain/club-sites";

const club = {
  id: "club-1",
  name: "La Quinta",
  slug: "la-quinta",
  description: null,
  home_venue: null,
  logo_path: null,
  is_public: true,
  status: "active" as const,
  created_at: "2026-05-01T00:00:00.000Z"
};

describe("club site settings", () => {
  it("normaliza colores, fuente, contactos y secciones con defaults seguros", () => {
    const settings = normalizeClubSiteSettings(
      {
        club_id: club.id,
        enabled: true,
        published: true,
        domain: " laquinta.com.ar ",
        hero_image_path: "public/clubs/club-1/hero.webp",
        primary_color: "naranja",
        secondary_color: "#101010",
        accent_color: "#25D366",
        font_family: "oswald",
        whatsapp_url_or_phone: " 5491112345678 ",
        instagram_url: " https://instagram.com/laquintafc ",
        section_visibility: {
          catalog: true,
          teamData: false,
          records: false,
          madeUp: true
        }
      },
      club
    );

    expect(settings).toMatchObject({
      clubId: club.id,
      enabled: true,
      published: true,
      domain: "laquinta.com.ar",
      heroImagePath: "public/clubs/club-1/hero.webp",
      primaryColor: "#ff9900",
      secondaryColor: "#101010",
      accentColor: "#25D366",
      fontFamily: "oswald",
      whatsappUrlOrPhone: "5491112345678",
      instagramUrl: "https://instagram.com/laquintafc"
    });
    expect(settings.sectionVisibility.catalog).toBe(true);
    expect(settings.sectionVisibility.teamData).toBe(false);
    expect(settings.sectionVisibility.records).toBe(false);
    expect(settings.sectionVisibility.matches).toBe(true);
    expect("madeUp" in settings.sectionVisibility).toBe(false);
  });

  it("prefiere dominio propio para el href publico cuando esta configurado", () => {
    const withDomain = normalizeClubSiteSettings(
      {
        club_id: club.id,
        enabled: true,
        published: true,
        domain: "laquinta.com.ar"
      },
      club
    );
    const withoutDomain = normalizeClubSiteSettings(null, club);

    expect(buildClubSitePublicHref(club, withDomain)).toBe("https://laquinta.com.ar");
    expect(buildClubSitePublicHref(club, withDomain, "/catalogo")).toBe("https://laquinta.com.ar/catalogo");
    expect(buildClubSitePublicHref(club, withoutDomain, "/equipo")).toBe("/clubs/la-quinta/equipo");
  });

  it("detecta host propio para indexacion sin confundir previews de Fabrica", () => {
    const settings = normalizeClubSiteSettings(
      {
        club_id: club.id,
        domain: "www.laquinta.com.ar"
      },
      club
    );

    expect(isClubSiteCustomDomainHost("laquinta.com.ar", settings)).toBe(true);
    expect(isClubSiteCustomDomainHost("www.laquinta.com.ar", settings)).toBe(true);
    expect(isClubSiteCustomDomainHost("fabricadefutbol.com.ar", settings)).toBe(false);
  });
});

describe("club catalog contact links", () => {
  const settings = normalizeClubSiteSettings(
    {
      club_id: club.id,
      enabled: true,
      published: true,
      whatsapp_url_or_phone: "5491112345678",
      instagram_url: "https://instagram.com/laquintafc"
    },
    club
  );

  it("usa WhatsApp global con mensaje de producto por default", () => {
    const href = buildClubProductContactHref({
      product: {
        id: "product-1",
        club_id: club.id,
        name: "Camiseta Titular 2026",
        slug: "camiseta-titular-2026",
        description: null,
        category: "Camisetas",
        image_path: null,
        price_label: "Consultar precio",
        status: "available",
        visible: true,
        sort_order: 1,
        contact_channel: "whatsapp",
        contact_url: null,
        contact_message: null,
        created_at: "2026-05-01T00:00:00.000Z",
        updated_at: "2026-05-01T00:00:00.000Z"
      },
      settings
    });

    expect(href).toBe(
      "https://wa.me/5491112345678?text=Hola%20La%20Quinta%2C%20quiero%20consultar%20por%20Camiseta%20Titular%202026."
    );
  });

  it("permite override por Instagram o link custom por producto", () => {
    expect(
      buildClubProductContactHref({
        product: {
          id: "product-2",
          club_id: club.id,
          name: "Sticker Pack",
          slug: "sticker-pack",
          description: null,
          category: "Merch",
          image_path: null,
          price_label: null,
          status: "available",
          visible: true,
          sort_order: 2,
          contact_channel: "instagram",
          contact_url: null,
          contact_message: null,
          created_at: "2026-05-01T00:00:00.000Z",
          updated_at: "2026-05-01T00:00:00.000Z"
        },
        settings
      })
    ).toBe("https://instagram.com/laquintafc");

    expect(
      buildClubProductContactHref({
        product: {
          id: "product-3",
          club_id: club.id,
          name: "Remera Oversize",
          slug: "remera-oversize",
          description: null,
          category: "Indumentaria",
          image_path: null,
          price_label: null,
          status: "available",
          visible: true,
          sort_order: 3,
          contact_channel: "custom",
          contact_url: "https://wa.me/5491199999999",
          contact_message: null,
          created_at: "2026-05-01T00:00:00.000Z",
          updated_at: "2026-05-01T00:00:00.000Z"
        },
        settings
      })
    ).toBe("https://wa.me/5491199999999");
  });

  it("filtra productos ocultos y ordena por sort_order y nombre", () => {
    const products: ClubProductRecord[] = [
      {
        id: "hidden",
        club_id: club.id,
        name: "Oculto",
        slug: "oculto",
        description: null,
        category: "Merch",
        image_path: null,
        price_label: null,
        status: "available",
        visible: false,
        sort_order: 0,
        contact_channel: "whatsapp",
        contact_url: null,
        contact_message: null,
        created_at: "2026-05-01T00:00:00.000Z",
        updated_at: "2026-05-01T00:00:00.000Z"
      },
      {
        id: "b",
        club_id: club.id,
        name: "Buzo",
        slug: "buzo",
        description: null,
        category: "Indumentaria",
        image_path: null,
        price_label: null,
        status: "available",
        visible: true,
        sort_order: 2,
        contact_channel: "whatsapp",
        contact_url: null,
        contact_message: null,
        created_at: "2026-05-01T00:00:00.000Z",
        updated_at: "2026-05-01T00:00:00.000Z"
      },
      {
        id: "a",
        club_id: club.id,
        name: "Camiseta",
        slug: "camiseta",
        description: null,
        category: "Camisetas",
        image_path: null,
        price_label: null,
        status: "available",
        visible: true,
        sort_order: 1,
        contact_channel: "whatsapp",
        contact_url: null,
        contact_message: null,
        created_at: "2026-05-01T00:00:00.000Z",
        updated_at: "2026-05-01T00:00:00.000Z"
      }
    ];

    expect(filterVisibleClubProducts(products).map((product) => product.id)).toEqual(["a", "b"]);
  });
});
