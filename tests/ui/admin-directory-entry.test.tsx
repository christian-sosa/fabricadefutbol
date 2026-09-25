import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }),
  dashboard: vi.fn()
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/app/admin/(panel)/actions", () => ({ archiveOrganizationAction: vi.fn(), restoreOrganizationAction: vi.fn(), deleteOrganizationAction: vi.fn() }));
vi.mock("@/app/admin/(panel)/form-actions", () => ({ createOrganizationFormAction: vi.fn(), uploadOrganizationImageFormAction: vi.fn() }));
vi.mock("@/lib/auth/admin", () => ({
  getAdminOrganizationContext: async () => ({
    admin: { isSuperAdmin: false },
    organizations: [{ id: "group-a", name: "Los viernes", slug: "viernes", is_public: true, created_at: "2026-01-01" }]
  }),
  getAdminOrganizationCreationAccess: async () => ({ canCreateOrganization: false }),
  getArchivedAdminOrganizations: async () => [],
  getOrganizationWriteAccess: vi.fn()
}));
vi.mock("@/lib/queries/admin", () => ({ getAdminDashboardData: mocks.dashboard }));
vi.mock("@/lib/queries/public", () => ({ getOrganizationSeasons: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));

import AdminDashboardPage from "@/app/admin/(panel)/page";

describe("entrada explícita al directorio de grupos", () => {
  beforeEach(() => vi.clearAllMocks());

  it("mantiene el acceso automático al único grupo desde /admin", async () => {
    await expect(AdminDashboardPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT:/admin?org=viernes");
    expect(mocks.dashboard).not.toHaveBeenCalled();
  });

  it.each([{ view: "groups" }, { view: "groups", org: "viernes" }])("permite elegir el único grupo desde el directorio explícito: %j", async (searchParams) => {
    render(await AdminDashboardPage({ searchParams: Promise.resolve(searchParams) }));
    expect(screen.getByRole("heading", { name: "Tus grupos" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Buscar entre tus grupos" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Administrar Los viernes" })).toHaveAttribute("href", "/admin?org=viernes");
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.dashboard).not.toHaveBeenCalled();
  });
});
