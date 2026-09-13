import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ replace: vi.fn(), track: vi.fn(), params: new URLSearchParams() }));
vi.mock("@/lib/analytics/client", () => ({ trackAnalyticsEvent: state.track }));
vi.mock("next/navigation", () => ({ usePathname: () => "/admin", useRouter: () => ({ replace: state.replace }), useSearchParams: () => state.params }));
import { GrowthEventTracker } from "@/components/analytics/growth-event-tracker";

describe("GrowthEventTracker", () => {
  beforeEach(() => { vi.clearAllMocks(); state.params = new URLSearchParams(); });
  it("limpia redirects viejos sin duplicar eventos de negocio", async () => {
    state.params = new URLSearchParams("org=los-pibes&ff_event=group_created&ff_source=server");
    render(<GrowthEventTracker />);
    await waitFor(() => expect(state.replace).toHaveBeenCalledWith("/admin?org=los-pibes", { scroll: false }));
    expect(state.track).not.toHaveBeenCalled();
  });
  it("detecta una visita referida sin reenviar la query completa", async () => {
    state.params = new URLSearchParams("utm_source=whatsapp&utm_medium=share&utm_campaign=group_growth&utm_content=ranking&token=private");
    render(<GrowthEventTracker />);
    await waitFor(() => expect(state.track).toHaveBeenCalledWith("referral_visit", { source: "whatsapp", content: "ranking" }, { path: "/admin" }));
    expect(JSON.stringify(state.track.mock.calls)).not.toContain("private");
  });
});
