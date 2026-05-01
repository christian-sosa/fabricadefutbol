import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GrowthEventTracker } from "@/components/analytics/growth-event-tracker";

const replaceMock = vi.fn();
const searchParams = new URLSearchParams("org=los-pibes&ff_event=group_created&ff_source=server");

vi.mock("@vercel/analytics", () => ({
  track: vi.fn()
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => searchParams
}));

describe("GrowthEventTracker", () => {
  it("trackea el evento de query param y limpia la URL", async () => {
    const { track } = await import("@vercel/analytics");

    render(<GrowthEventTracker />);

    await waitFor(() => {
      expect(track).toHaveBeenCalledWith("group_created", {
        source: "server"
      });
    });
    expect(replaceMock).toHaveBeenCalledWith("/admin?org=los-pibes", { scroll: false });
  });
});
