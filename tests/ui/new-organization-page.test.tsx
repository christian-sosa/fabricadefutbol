import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import NewOrganizationPage from "@/app/admin/(panel)/new/page";

const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@/app/admin/(panel)/form-actions", () => ({ createOrganizationFormAction: mocks.create }));
vi.mock("@/lib/analytics/client", () => ({ trackAnalyticsEvent: vi.fn() }));
vi.mock("@/lib/auth/admin", () => ({
  getAdminOrganizationContext: async () => ({ admin: {}, organizations: [], selectedOrganization: { id: "00000000-0000-4000-8000-000000000001", slug: "existing" } }),
  getAdminOrganizationCreationAccess: async () => ({ canCreateOrganization: true })
}));

describe("alta de grupo", () => {
  it("reintenta con el mismo UUID nuevo y conserva el nombre tras un error", async () => {
    mocks.create.mockResolvedValue({ error: "No pudimos confirmar el alta. Intentá de nuevo." });
    render(await NewOrganizationPage({ searchParams: Promise.resolve({}) }));
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox", { name: "Nombre del nuevo grupo" }), "Los viernes");
    await user.click(screen.getByRole("button", { name: "Crear grupo" }));
    await screen.findByRole("alert");
    const first = mocks.create.mock.calls[0][0] as FormData;
    expect(first.get("organizationId")).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);
    expect(first.get("organizationId")).not.toBe("00000000-0000-4000-8000-000000000001");
    expect(screen.getByRole("textbox")).toHaveValue("Los viernes");
    await user.click(screen.getByRole("button", { name: "Crear grupo" }));
    expect((mocks.create.mock.calls[1][0] as FormData).get("organizationId")).toBe(first.get("organizationId"));
    expect(first.has("image")).toBe(false);
  });
});
