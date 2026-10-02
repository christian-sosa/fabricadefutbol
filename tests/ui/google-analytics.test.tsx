import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ id: vi.fn(), path: "/" }));
vi.mock("@/lib/env", () => ({ getGoogleAnalyticsMeasurementId: mocks.id }));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.path }));
vi.mock("next/script", () => ({ default: ({ src }: { src: string }) => <div data-testid="google-script" data-src={src} /> }));
import { GoogleAnalytics } from "@/components/analytics/google-analytics";
import { getGooglePageContext, trackGoogleAnalyticsEvent } from "@/lib/analytics/google";
import { GOOGLE_OUTCOME_COOKIE } from "@/lib/analytics/google-outcome";
import { GOOGLE_CONSENT_STORAGE } from "@/lib/analytics/google-consent";

function commands() { return (window.dataLayer ?? []).map((entry) => Array.from(entry as ArrayLike<unknown>)); }

describe("medición Google opcional", () => {
  beforeEach(() => {
    mocks.id.mockReturnValue("G-TEST12345");
    mocks.path = "/";
    delete window.gtag;
    delete window.dataLayer;
    delete window.fdfGoogleAnalyticsId;
    window.sessionStorage.clear();
    window.localStorage.clear();
    window.localStorage.setItem(GOOGLE_CONSENT_STORAGE, "accepted");
    window.history.replaceState({}, "", "/");
    document.cookie = `${GOOGLE_OUTCOME_COOKIE}=; Max-Age=0; Path=/`;
  });

  it("no carga scripts ni crea la cola si no hay ID configurado", () => {
    mocks.id.mockReturnValue(null);
    const view = render(<GoogleAnalytics />);
    expect(view.queryByTestId("google-script")).toBeNull();
    expect(view.queryByRole("button", { name: "Aceptar medición" })).toBeNull();
    expect(trackGoogleAnalyticsEvent("generate_lead")).toBe(false);
    expect(window.dataLayer).toBeUndefined();
  });

  it("sólo inicia Google después de aceptar y conserva la elección", () => {
    window.localStorage.removeItem(GOOGLE_CONSENT_STORAGE);
    const view = render(<GoogleAnalytics />);
    expect(view.queryByTestId("google-script")).toBeNull();
    expect(window.dataLayer).toBeUndefined();
    expect(trackGoogleAnalyticsEvent("generate_lead")).toBe(false);
    fireEvent.click(view.getByRole("button", { name: "Aceptar medición" }));
    expect(view.getByTestId("google-script")).toBeInTheDocument();
    expect(window.localStorage.getItem(GOOGLE_CONSENT_STORAGE)).toBe("accepted");
    expect(commands().filter((entry) => entry[1] === "page_view")).toHaveLength(1);
    expect(commands().find((entry) => entry[0] === "consent")?.[2]).toMatchObject({ ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
  });

  it("rechaza sin cargar Google y no reenvía un alta anterior al cambiar la elección", () => {
    window.localStorage.removeItem(GOOGLE_CONSENT_STORAGE);
    document.cookie = `${GOOGLE_OUTCOME_COOKIE}=group_created:b0000000-0000-4000-8000-000000000001; Path=/`;
    const view = render(<GoogleAnalytics />);
    fireEvent.click(view.getByRole("button", { name: "No aceptar" }));
    expect(window.localStorage.getItem(GOOGLE_CONSENT_STORAGE)).toBe("denied");
    expect(view.queryByTestId("google-script")).toBeNull();
    expect(window.dataLayer).toBeUndefined();
    mocks.path = "/privacy";
    window.history.replaceState({}, "", "/privacy");
    view.rerender(<GoogleAnalytics />);
    fireEvent.click(view.getByRole("button", { name: "Cambiar preferencia de medición" }));
    fireEvent.click(view.getByRole("button", { name: "Aceptar medición" }));
    expect(commands().filter((entry) => entry[1] === "group_created")).toHaveLength(0);
  });

  it("deja de medir al retirar la aceptación y al navegar a una ruta sensible", () => {
    mocks.path = "/privacy";
    window.history.replaceState({}, "", "/privacy");
    const view = render(<GoogleAnalytics />);
    fireEvent.click(view.getByRole("button", { name: "Cambiar preferencia de medición" }));
    fireEvent.click(view.getByRole("button", { name: "No aceptar" }));
    expect((window as unknown as Record<string, unknown>)["ga-disable-G-TEST12345"]).toBe(true);
    expect(trackGoogleAnalyticsEvent("generate_lead")).toBe(false);
    expect(view.queryByTestId("google-script")).toBeNull();
    fireEvent.click(view.getByRole("button", { name: "Cambiar preferencia de medición" }));
    fireEvent.click(view.getByRole("button", { name: "Aceptar medición" }));
    mocks.path = "/auth/callback";
    window.history.replaceState({}, "", mocks.path);
    view.rerender(<GoogleAnalytics />);
    expect((window as unknown as Record<string, unknown>)["ga-disable-G-TEST12345"]).toBe(true);
    expect(view.queryByTestId("google-script")).toBeNull();
  });

  it("aplica una revocación comunicada desde otra pestaña al tag ya cargado", () => {
    const view = render(<GoogleAnalytics />);
    expect(view.getByTestId("google-script")).toBeInTheDocument();
    window.localStorage.setItem(GOOGLE_CONSENT_STORAGE, "denied");
    fireEvent(window, new StorageEvent("storage", { key: GOOGLE_CONSENT_STORAGE, newValue: "denied" }));
    expect(view.queryByTestId("google-script")).toBeNull();
    expect((window as unknown as Record<string, unknown>)["ga-disable-G-TEST12345"]).toBe(true);
    expect(commands().filter((entry) => entry[0] === "consent").at(-1)?.[2]).toMatchObject({ analytics_storage: "denied", ad_storage: "denied" });
    expect(trackGoogleAnalyticsEvent("generate_lead")).toBe(false);
  });

  it("emite una vista por navegación sin query, identificadores ni título del grupo", () => {
    window.history.replaceState({}, "", "/matches/private-match?org=nombre-privado&email=ana@example.test#token");
    document.title = "Ana Pérez · grupo privado";
    mocks.path = "/matches/private-match";
    const view = render(<GoogleAnalytics />);
    view.rerender(<GoogleAnalytics />);
    const pageviews = commands().filter((entry) => entry[1] === "page_view");
    expect(pageviews).toHaveLength(1);
    expect(pageviews[0][2]).toMatchObject({ page_location: `${window.location.origin}/matches/:id`, page_title: "Fábrica de Fútbol · /matches/:id" });
    expect(JSON.stringify(commands())).not.toMatch(/private-match|nombre-privado|ana@example|Ana Pérez|#token/);
    expect(commands().find((entry) => entry[0] === "config")?.[2]).toMatchObject({ send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false });
  });

  it("omite autenticación e invitaciones y sanitiza el referer", () => {
    expect(getGooglePageContext("https://fdf.test/auth/callback?code=secret")).toBeNull();
    expect(getGooglePageContext("https://fdf.test/auth/unknown?code=secret")).toBeNull();
    expect(getGooglePageContext("https://fdf.test/api/unknown")).toBeNull();
    expect(getGooglePageContext("https://fdf.test/invite/private-token")).toBeNull();
    expect(getGooglePageContext("https://fdf.test/admin/reset-password")).toBeNull();
    expect(getGooglePageContext("https://fdf.test/", "https://other.test/path?email=ana@example.test")?.page_referrer).toBe("https://other.test");
    mocks.path = "/invite/private-token";
    window.history.replaceState({}, "", mocks.path);
    expect(render(<GoogleAnalytics />).queryByTestId("google-script")).toBeNull();
    expect(window.dataLayer).toBeUndefined();
  });

  it("consume un resultado de servidor una sola vez sin mandar su nonce", () => {
    const id = "a0000000-0000-4000-8000-000000000001";
    document.cookie = `${GOOGLE_OUTCOME_COOKIE}=group_created:${id}; Path=/`;
    const view = render(<GoogleAnalytics />);
    view.rerender(<GoogleAnalytics />);
    expect(trackGoogleAnalyticsEvent("group_created", {}, id)).toBe(false);
    expect(commands().filter((entry) => entry[1] === "group_created")).toHaveLength(1);
    expect(document.cookie).not.toContain(GOOGLE_OUTCOME_COOKIE);
    expect(JSON.stringify(commands())).not.toContain(id);
  });

  it("permite sólo parámetros controlados y absorbe fallos de Google", () => {
    expect(trackGoogleAnalyticsEvent("generate_lead", { contact_category: "setup_help", email: "ana@example.test", message: "mensaje privado", source: "ana@example.test", group_name: "Los viernes" })).toBe(true);
    const payload = commands().find((entry) => entry[1] === "generate_lead")?.[2];
    expect(payload).toMatchObject({ contact_category: "setup_help" });
    expect(JSON.stringify(payload)).not.toMatch(/ana@example|mensaje privado|Los viernes/);
    window.gtag = () => { throw new Error("blocked"); };
    expect(() => trackGoogleAnalyticsEvent("generate_lead")).not.toThrow();
  });
});
