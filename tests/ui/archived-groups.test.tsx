import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import AdminDashboardPage from "@/app/admin/(panel)/page";

const actions = vi.hoisted(() => ({ archiveOrganizationAction: vi.fn(), restoreOrganizationAction: vi.fn(), deleteOrganizationAction: vi.fn() }));
vi.mock("@/app/admin/(panel)/actions", () => actions);
vi.mock("@/app/admin/(panel)/form-actions", () => ({ createOrganizationFormAction: vi.fn(), uploadOrganizationImageFormAction: vi.fn() }));
vi.mock("@/lib/auth/admin", () => ({
  getAdminOrganizationContext: async () => ({ admin: { isSuperAdmin: true }, organizations: [] }),
  getAdminOrganizationCreationAccess: async () => ({ canCreateOrganization: true }),
  getArchivedAdminOrganizations: async () => [{ id: "archive-1", name: "Los viernes", slug: "viernes", is_public: true, created_at: "2026-01-01", archived_at: "2026-09-14" }],
  getOrganizationWriteAccess: vi.fn()
}));
vi.mock("@/lib/queries/admin", () => ({ getAdminDashboardData: vi.fn() }));
vi.mock("@/lib/queries/public", () => ({ getOrganizationSeasons: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));

describe("archived groups", () => {
  it("prioriza restaurar y reserva el borrado definitivo para un despliegue explícito", async () => {
    render(await AdminDashboardPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("Grupos archivados")).toBeInTheDocument();
    const restore = screen.getByRole("button", { name: "Restaurar Los viernes" });
    expect(restore).toBeVisible();
    expect(screen.getByRole("button", { name: "Eliminar definitivamente Los viernes" })).not.toBeVisible();
    await userEvent.click(screen.getByText("Eliminación definitiva"));
    expect(screen.getByRole("button", { name: "Eliminar definitivamente Los viernes" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Seguridad" })).toHaveAttribute("href", "/admin/security");
    await userEvent.click(restore);
    expect(actions.restoreOrganizationAction).toHaveBeenCalledOnce();
    expect(actions.restoreOrganizationAction.mock.calls[0][0].get("organizationId")).toBe("archive-1");
    expect(actions.deleteOrganizationAction).not.toHaveBeenCalled();
  });
});
