import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import AdminDashboardPage from "@/app/admin/(panel)/page";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
  useSearchParams: () => new URLSearchParams("org=viernes"),
  redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); }
}));
vi.mock("@/app/admin/(panel)/actions", () => ({
  archiveOrganizationAction: vi.fn(), restoreOrganizationAction: vi.fn(), deleteOrganizationAction: vi.fn()
}));
vi.mock("@/app/admin/(panel)/form-actions", () => ({
  createOrganizationFormAction: vi.fn(), setOrganizationListedFormAction: vi.fn(), uploadOrganizationImageFormAction: vi.fn()
}));
vi.mock("@/lib/auth/admin", () => ({
  getAdminOrganizationContext: async () => ({
    admin: { userId: "admin-1", displayName: "Ana", email: "ana@example.test", isSuperAdmin: false },
    organizations: [{ id: "group-1", name: "Los viernes", slug: "viernes", is_public: true, created_at: "2026-01-01" }]
  }),
  getAdminOrganizationCreationAccess: async () => ({ canCreateOrganization: false }),
  getArchivedAdminOrganizations: async () => [],
  getOrganizationWriteAccess: async () => ({ canWrite: true })
}));
vi.mock("@/lib/queries/admin", () => ({
  getAdminDashboardData: async () => ({ playersCount: 10, draftsCount: 0, confirmedCount: 0, finishedCount: 1, latestMatches: [] })
}));
vi.mock("@/lib/queries/public", () => ({ getOrganizationSeasons: async () => [] }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ rpc: async () => ({ error: null }) })
}));

describe("portada del grupo en el panel", () => {
  it("muestra la portada al abrir personalización y reserva la carga para Cambiar imagen", async () => {
    const user = userEvent.setup();
    render(await AdminDashboardPage({ searchParams: Promise.resolve({ org: "viernes" }) }));

    const preview = screen.getByAltText("Imagen de Los viernes");
    const input = screen.getByLabelText("Foto de portada");
    const save = screen.getByRole("button", { name: "Guardar imagen" });
    expect(preview).not.toBeVisible();
    expect(input).not.toBeVisible();

    await user.click(screen.getByText("Personalizar foto de portada"));
    expect(preview).toBeVisible();
    expect(preview).toHaveAttribute("src", "/api/organization-image/group-1");
    expect(screen.getByText("Identidad publica")).toBeVisible();
    expect(input).not.toBeVisible();
    expect(save).not.toBeVisible();

    await user.click(screen.getByText("Cambiar imagen"));
    expect(input).toBeVisible();
    expect(save).toBeVisible();
    expect(preview).toBeVisible();
    expect(new FormData(save.closest("form")!).get("organizationId")).toBe("group-1");

    await user.click(screen.getByText("Cambiar imagen"));
    expect(input).not.toBeVisible();
    expect(save).not.toBeVisible();
    expect(preview).toBeVisible();
  });
});
