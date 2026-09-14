import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SiteHeader } from "@/components/layout/site-header";

const mocks = vi.hoisted(() => ({
  pathname: "/",
  searchParams: new URLSearchParams(),
  refresh: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn(),
  unsubscribe: vi.fn(),
  unavailable: false
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useSearchParams: () => mocks.searchParams,
  useRouter: () => ({ refresh: mocks.refresh })
}));
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => {
    if (mocks.unavailable) throw new Error("unavailable");
    return { auth: {
      getSession: mocks.getSession,
      signOut: mocks.signOut,
      onAuthStateChange: () => ({data: {subscription: {unsubscribe: mocks.unsubscribe}}})
    }};
  }
}));

describe("SiteHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pathname = "/";
    mocks.searchParams = new URLSearchParams();
    mocks.unavailable = false;
    mocks.getSession.mockResolvedValue({data: {session: {user: {id: "fixture"}}}});
    mocks.signOut.mockResolvedValue({error: null});
  });

  it("cierra el menú con Escape y devuelve el foco a su disparador", async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);
    await user.click(screen.getByRole("button", {name: "Abrir menu"}));
    const mobileNav = screen.getByRole("navigation", {name: "Navegación principal móvil"});
    within(mobileNav).getByRole("link", {name: "Grupos"}).focus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("navigation", {name: "Navegación principal móvil"})).not.toBeInTheDocument();
    expect(screen.getByRole("button", {name: "Abrir menu"})).toHaveFocus();
  });

  it("cierra el menú al elegir la página actual aunque la URL no cambie", async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);
    await user.click(screen.getByRole("button", {name: "Abrir menu"}));
    const currentLink = within(screen.getByRole("navigation", {name: "Navegación principal móvil"})).getByRole("link", {name: "Inicio"});
    expect(currentLink).toHaveAttribute("aria-current", "page");
    currentLink.addEventListener("click", (event) => event.preventDefault());
    await user.click(currentLink);
    expect(screen.getByRole("button", {name: "Abrir menu"})).toHaveAttribute("aria-expanded", "false");
  });

  it("conserva la cuenta visible y permite reintentar si signOut devuelve un error", async () => {
    const user = userEvent.setup();
    mocks.signOut.mockResolvedValueOnce({error: {message: "Network error"}});
    render(<SiteHeader initialIsAuthenticated />);
    await user.click(await screen.findByRole("button", {name: "Salir"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos cerrar la sesión");
    expect(screen.getByRole("link", {name: "Panel"})).toBeVisible();
    expect(mocks.refresh).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", {name: "Salir"}));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("link", {name: "Ingresar / Registro"})).toBeVisible();
  });

  it("maneja una excepción de red sin mostrar un cierre de sesión exitoso", async () => {
    mocks.signOut.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<SiteHeader initialIsAuthenticated />);
    await userEvent.click(await screen.findByRole("button", {name: "Salir"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("Revisá tu conexión");
    expect(screen.getByRole("button", {name: "Salir"})).toBeEnabled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("evita solicitudes duplicadas mientras está cerrando la sesión", async () => {
    let finish!: (result: {error: null}) => void;
    mocks.signOut.mockImplementation(() => new Promise((resolve) => {finish = resolve;}));
    render(<SiteHeader initialIsAuthenticated />);
    await userEvent.click(await screen.findByRole("button", {name: "Salir"}));
    const pending = screen.getByRole("button", {name: "Cerrando sesión..."});
    expect(pending).toBeDisabled();
    await userEvent.click(pending);
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    await act(async () => finish({error: null}));
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });
});
