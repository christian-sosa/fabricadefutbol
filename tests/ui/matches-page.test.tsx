import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getHistory, getCalendar, getSeasons, resolveOrganization, getAdminOrganizations } = vi.hoisted(() => ({
  getHistory: vi.fn(), getCalendar: vi.fn(), getSeasons: vi.fn(), resolveOrganization: vi.fn(), getAdminOrganizations: vi.fn()
}));
vi.mock("@/lib/queries/public", () => ({
  getMatchHistoryCardsPage: getHistory,
  getMatchCalendarActivity: getCalendar,
  getOrganizationSeasons: getSeasons,
  resolvePublicOrganization: resolveOrganization,
  getViewerAdminOrganizations: getAdminOrganizations
}));
vi.mock("@/components/groups/public-group-growth-cta", () => ({ PublicGroupGrowthCta: () => null }));
vi.mock("@/components/layout/organization-public-nav", () => ({ OrganizationPublicNav: () => null }));
vi.mock("@/components/layout/organization-switcher", () => ({ OrganizationSwitcher: () => null }));
vi.mock("@/components/matches/matches-history-query-table", () => ({
  MatchesHistoryQueryTable: ({ initialPage, season }: { initialPage: number; season: string }) => <p>Página inicial {initialPage}, temporada {season}</p>
}));
vi.mock("@/components/matches/match-activity-calendar", () => ({
  MatchActivityCalendar: ({ organizationSlug, season, historyPage }: { organizationSlug: string; season: string; historyPage: number }) => <p>Calendario de {organizationSlug}, temporada {season}, página {historyPage}</p>
}));
import MatchesPage from "@/app/matches/page";

beforeEach(() => {
  vi.clearAllMocks();
  getHistory.mockResolvedValue({ matches: [], pagination: { page: 2 } });
  getCalendar.mockResolvedValue({ matches: [], season: null });
  getSeasons.mockResolvedValue([]);
  getAdminOrganizations.mockResolvedValue([]);
  resolveOrganization.mockResolvedValue({ organizations: [], selectedOrganization: { id: "group-1", slug: "grupo", name: "Grupo" } });
});

describe("server history page", () => {
  it("fetches and hydrates the selected URL page on reload", async () => {
    render(await MatchesPage({ searchParams: Promise.resolve({ org: "grupo", season: "all", page: "2" }) }));
    expect(getHistory).toHaveBeenCalledWith("group-1", { page: 2, pageSize: 10, season: "all" });
    expect(screen.getByText("Página inicial 2, temporada all")).toBeInTheDocument();
    expect(getCalendar).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Ver calendario" })).toHaveAttribute("href", "/matches?org=grupo&season=all&page=2&view=calendar");
  });

  it("defaults malformed page and season parameters without passing them to the database", async () => {
    render(await MatchesPage({ searchParams: Promise.resolve({ org: "grupo", season: "unknown", page: "2e8" }) }));
    expect(getHistory).toHaveBeenCalledWith("group-1", { page: 1, pageSize: 10, season: "current" });
    expect(screen.getByText("Página inicial 1, temporada current")).toBeInTheDocument();
  });

  it("reads calendar activity only when requested and keeps the list return context", async () => {
    render(await MatchesPage({ searchParams: Promise.resolve({ org: "grupo", season: "all", page: "3", view: "calendar" }) }));

    expect(getCalendar).toHaveBeenCalledWith("group-1", "all");
    expect(getHistory).not.toHaveBeenCalled();
    expect(screen.getByText("Calendario de grupo, temporada all, página 3")).toBeInTheDocument();
    expect(screen.queryByText(/Página inicial/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver a la lista" })).toHaveAttribute("href", "/matches?org=grupo&season=all&page=3");
  });

  it("keeps calendar mode when changing seasons and resets pagination for that season", async () => {
    const closedSeason = "00000000-0000-4000-8000-000000000001";
    getSeasons.mockResolvedValue([
      { id: "active", label: "Temporada 2026", status: "active" },
      { id: closedSeason, label: "Temporada 2025", status: "closed" }
    ]);
    render(await MatchesPage({ searchParams: Promise.resolve({ org: "grupo", season: closedSeason, page: "3", view: "calendar" }) }));

    expect(getCalendar).toHaveBeenCalledWith("group-1", closedSeason);
    expect(screen.getByRole("link", { name: "Temporada 2026" })).toHaveAttribute("href", "/matches?org=grupo&view=calendar");
    expect(screen.getByRole("link", { name: "Temporada 2025" })).toHaveAttribute("href", `/matches?org=grupo&season=${closedSeason}&view=calendar`);
    expect(screen.getByRole("link", { name: "Historico" })).toHaveAttribute("href", "/matches?org=grupo&season=all&view=calendar");
    expect(screen.getByRole("link", { name: "Volver a la lista" })).toHaveAttribute("href", `/matches?org=grupo&season=${closedSeason}&page=3`);
  });

  it("falls back to the list for unknown views without fetching the calendar", async () => {
    render(await MatchesPage({ searchParams: Promise.resolve({ org: "grupo", view: "other" }) }));
    expect(getCalendar).not.toHaveBeenCalled();
    expect(getHistory).toHaveBeenCalledWith("group-1", { page: 1, pageSize: 10, season: "current" });
    expect(screen.getByRole("link", { name: "Ver calendario" })).toHaveAttribute("href", "/matches?org=grupo&view=calendar");
  });

  it("does not query or offer the calendar without a selected group", async () => {
    resolveOrganization.mockResolvedValue({ organizations: [], selectedOrganization: null });
    render(await MatchesPage({ searchParams: Promise.resolve({ view: "calendar" }) }));
    expect(getCalendar).not.toHaveBeenCalled();
    expect(getHistory).toHaveBeenCalledWith(null, { page: 1, pageSize: 10, season: "current" });
    expect(screen.queryByRole("link", { name: /Ver calendario|Volver a la lista/ })).not.toBeInTheDocument();
  });
});
