import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getHistory, getSeasons, resolveOrganization, getAdminOrganizations } = vi.hoisted(() => ({
  getHistory: vi.fn(), getSeasons: vi.fn(), resolveOrganization: vi.fn(), getAdminOrganizations: vi.fn()
}));
vi.mock("@/lib/queries/public", () => ({
  getMatchHistoryCardsPage: getHistory,
  getOrganizationSeasons: getSeasons,
  resolvePublicOrganization: resolveOrganization,
  getViewerAdminOrganizations: getAdminOrganizations
}));
vi.mock("@/components/groups/public-group-growth-cta", () => ({ PublicGroupGrowthCta: () => null }));
vi.mock("@/components/groups/season-filter-links", () => ({ SeasonFilterLinks: () => null }));
vi.mock("@/components/layout/organization-public-nav", () => ({ OrganizationPublicNav: () => null }));
vi.mock("@/components/layout/organization-switcher", () => ({ OrganizationSwitcher: () => null }));
vi.mock("@/components/matches/matches-history-query-table", () => ({
  MatchesHistoryQueryTable: ({ initialPage, season }: { initialPage: number; season: string }) => <p>Página inicial {initialPage}, temporada {season}</p>
}));
import MatchesPage from "@/app/matches/page";

beforeEach(() => {
  vi.clearAllMocks();
  getHistory.mockResolvedValue({ matches: [], pagination: { page: 2 } });
  getSeasons.mockResolvedValue([]);
  getAdminOrganizations.mockResolvedValue([]);
  resolveOrganization.mockResolvedValue({ organizations: [], selectedOrganization: { id: "group-1", slug: "grupo", name: "Grupo" } });
});

describe("server history page", () => {
  it("fetches and hydrates the selected URL page on reload", async () => {
    render(await MatchesPage({ searchParams: Promise.resolve({ org: "grupo", season: "all", page: "2" }) }));
    expect(getHistory).toHaveBeenCalledWith("group-1", { page: 2, pageSize: 10, season: "all" });
    expect(screen.getByText("Página inicial 2, temporada all")).toBeInTheDocument();
  });

  it("defaults malformed page and season parameters without passing them to the database", async () => {
    render(await MatchesPage({ searchParams: Promise.resolve({ org: "grupo", season: "unknown", page: "2e8" }) }));
    expect(getHistory).toHaveBeenCalledWith("group-1", { page: 1, pageSize: 10, season: "current" });
    expect(screen.getByText("Página inicial 1, temporada current")).toBeInTheDocument();
  });
});
