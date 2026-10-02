import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { publicClient } = vi.hoisted(() => ({ publicClient: vi.fn() }));
vi.mock("@/lib/supabase/public", () => ({ createSupabasePublicClient: publicClient }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next/cache", () => ({ unstable_noStore: vi.fn() }));

import { SeasonFilterLinks } from "@/components/groups/season-filter-links";
import { getOrganizationSeasons } from "@/lib/queries/public";
import { createFakeSupabase } from "../helpers/fake-supabase";

const ORG_ID = "group-local";
const LEGACY_ID = "legacy-2026";

describe("season filter links with legacy annual seasons", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-02T16:00:00Z"));
    publicClient.mockReturnValue(createFakeSupabase({
      organization_seasons: [{
        id: LEGACY_ID,
        organization_id: ORG_ID,
        label: "Temporada 2026",
        duration_months: 9,
        starts_at: "2026-04-04",
        ends_at: "2026-12-31",
        status: "active"
      }]
    }).client);
  });
  afterEach(() => vi.useRealTimers());

  it.each(["current", LEGACY_ID])("shows one selected 2026 link for %s", async (currentSeason) => {
    const seasons = await getOrganizationSeasons(ORG_ID);
    render(<SeasonFilterLinks
      basePath="/ranking"
      currentSeason={currentSeason}
      organizationSlug="grupo-local"
      seasons={seasons}
    />);

    const links = screen.getAllByRole("link", { name: "Temporada 2026" });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("aria-current", "page");
    expect(links[0]).toHaveAttribute("href", "/ranking?org=grupo-local");
    expect(screen.getByRole("link", { name: "Historico" }))
      .toHaveAttribute("href", "/ranking?org=grupo-local&season=all");
  });
});
