import { describe, expect, it, vi } from "vitest";

const { createSupabaseServerClientMock } = vi.hoisted(() => ({
  createSupabaseServerClientMock: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock
}));

import {
  getPublicClubSiteBySlug,
  getPublicClubSites
} from "@/lib/queries/clubs";
import { createFakeSupabase } from "../helpers/fake-supabase";

const activeClub = {
  id: "00000000-0000-4000-8000-000000000100",
  name: "La Quinta",
  slug: "la-quinta",
  description: "Club de amigos",
  home_venue: "Complejo Norte",
  logo_path: "public/clubs/la-quinta/logo.webp",
  is_public: true,
  status: "active",
  created_at: "2026-05-01T00:00:00.000Z"
};

describe("club site public queries", () => {
  it("lista solo clubes con sitio habilitado y publicado", async () => {
    const fake = createFakeSupabase({
      clubs: [
        activeClub,
        {
          id: "00000000-0000-4000-8000-000000000101",
          name: "Oculto FC",
          slug: "oculto-fc",
          description: null,
          home_venue: null,
          logo_path: null,
          is_public: true,
          status: "active",
          created_at: "2026-05-01T00:00:00.000Z"
        }
      ],
      club_site_settings: [
        {
          club_id: activeClub.id,
          enabled: true,
          published: true,
          domain: "laquinta.com.ar",
          primary_color: "#ff9900",
          secondary_color: "#0a0908",
          accent_color: "#25D366",
          section_visibility: { catalog: true, teamData: true }
        },
        {
          club_id: "00000000-0000-4000-8000-000000000101",
          enabled: true,
          published: false
        }
      ],
      club_products: [
        {
          id: "00000000-0000-4000-8000-000000000201",
          club_id: activeClub.id,
          name: "Camiseta",
          slug: "camiseta",
          category: "Camisetas",
          visible: true,
          status: "available",
          sort_order: 1
        }
      ]
    });
    createSupabaseServerClientMock.mockResolvedValue(fake.client);

    const sites = await getPublicClubSites();

    expect(sites).toHaveLength(1);
    expect(sites[0]).toMatchObject({
      club: {
        id: activeClub.id,
        name: "La Quinta",
        slug: "la-quinta"
      },
      productCount: 1
    });
    expect(sites[0].publicHref).toBe("https://laquinta.com.ar");
  });

  it("resuelve un sitio por slug con productos visibles ordenados y snapshot", async () => {
    const fake = createFakeSupabase({
      clubs: [activeClub],
      club_site_settings: [
        {
          club_id: activeClub.id,
          enabled: true,
          published: true,
          domain: null,
          whatsapp_url_or_phone: "5491112345678",
          section_visibility: {
            catalog: true,
            teamData: true,
            matches: true
          }
        }
      ],
      club_products: [
        {
          id: "00000000-0000-4000-8000-000000000203",
          club_id: activeClub.id,
          name: "Oculto",
          slug: "oculto",
          category: "Merch",
          visible: false,
          status: "available",
          sort_order: 0
        },
        {
          id: "00000000-0000-4000-8000-000000000202",
          club_id: activeClub.id,
          name: "Remera",
          slug: "remera",
          category: "Indumentaria",
          visible: true,
          status: "available",
          sort_order: 2
        },
        {
          id: "00000000-0000-4000-8000-000000000201",
          club_id: activeClub.id,
          name: "Camiseta",
          slug: "camiseta",
          category: "Camisetas",
          visible: true,
          status: "available",
          sort_order: 1
        }
      ],
      club_public_snapshots: [
        {
          club_id: activeClub.id,
          summary: {
            clubName: "La Quinta",
            teamCount: 2,
            playerCount: 20,
            playedMatches: 3,
            goalsFor: 9,
            goalsAgainst: 4,
            totalMatches: 3,
            totalGoals: 9,
            avgGoalsPerMatch: 3,
            totalPlayersDistinct: 20,
            totalAttendances: 32,
            presentNotPlayedCount: 1,
            firstMatchDate: "2026-04-01T00:00:00.000Z",
            lastMatchDate: "2026-05-01T00:00:00.000Z"
          },
          activity: [],
          teams: [],
          recent_matches: [],
          player_stats: [],
          records: {},
          top_scorers: [],
          top_assisters: [],
          top_figures: [],
          competition_stats: [],
          available_modalities: [],
          by_modality: {}
        }
      ]
    });
    createSupabaseServerClientMock.mockResolvedValue(fake.client);

    const data = await getPublicClubSiteBySlug("la-quinta");

    expect(data?.club.name).toBe("La Quinta");
    expect(data?.settings.enabled).toBe(true);
    expect(data?.products.map((product) => product.name)).toEqual(["Camiseta", "Remera"]);
    expect(data?.snapshot.summary.totalMatches).toBe(3);
  });
});
