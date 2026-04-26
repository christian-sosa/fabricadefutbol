import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigationState = vi.hoisted(() => ({
  pathname: "/",
  searchParams: new URLSearchParams()
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationState.pathname,
  useRouter: () => ({ refresh: vi.fn() }),
  useSearchParams: () => navigationState.searchParams
}));

vi.stubEnv("NEXT_PUBLIC_TOURNAMENTS_ENABLED", "false");

const { AdminNav } = await import("@/components/admin/admin-nav");
const { PublicModuleToggle } = await import("@/components/layout/public-module-toggle");
const { SiteFooter } = await import("@/components/layout/site-footer");
const { default: FeedbackPage } = await import("@/app/feedback/page");
const { default: HelpPage } = await import("@/app/help/page");
const { default: PricingPage } = await import("@/app/pricing/page");

describe("tournament feature flag disabled", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_TOURNAMENTS_ENABLED", "false");
    navigationState.pathname = "/";
    navigationState.searchParams = new URLSearchParams();
  });

  it("oculta torneos en el admin nav", () => {
    render(<AdminNav isSuperAdmin={false} />);

    expect(screen.getByRole("link", { name: "Grupos" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Torneos" })).not.toBeInTheDocument();
  });

  it("oculta torneos en el selector publico y footer", () => {
    render(
      <>
        <PublicModuleToggle basePath="/help" currentModule="organizations" />
        <SiteFooter />
      </>
    );

    expect(screen.getAllByRole("link", { name: /Grupos/ }).length).toBeGreaterThan(0);
    expect(screen.queryByText("Torneos")).not.toBeInTheDocument();
    expect(screen.getByText("Ranking real para grupos")).toBeInTheDocument();
  });

  it("muestra solo el plan de grupos en precios", () => {
    render(<PricingPage />);

    expect(screen.getByRole("heading", { name: "Grupos" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Torneos" })).not.toBeInTheDocument();
    expect(screen.getByText("Un plan simple para ordenar tu grupo.")).toBeInTheDocument();
  });

  it("muestra ayuda de grupos aunque llegue module=tournaments", async () => {
    const view = await HelpPage({
      searchParams: Promise.resolve({ module: "tournaments" })
    });

    render(view);

    expect(screen.getByText("Ayuda para Grupos")).toBeInTheDocument();
    expect(screen.queryByText("Ayuda para Torneos")).not.toBeInTheDocument();
  });

  it("no ofrece torneos en contacto aunque llegue module=tournaments", async () => {
    const view = await FeedbackPage({
      searchParams: Promise.resolve({ module: "tournaments" })
    });

    render(view);

    expect(screen.getByRole("option", { name: "Grupos" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Torneos" })).not.toBeInTheDocument();
    expect(screen.getByText("Si tu consulta es por grupos, ranking o partidos equilibrados, la recibimos por aqui.")).toBeInTheDocument();
  });
});
