import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/privacy",
  useRouter: () => ({ refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams()
}));

import PrivacyPage from "@/app/privacy/page";

describe("privacy adsense disclosure", () => {
  it("declara Google AdSense, cookies de terceros y tecnologias asociadas", async () => {
    const view = await PrivacyPage({
      searchParams: Promise.resolve({})
    });

    render(view);

    expect(screen.getAllByText(/Google AdSense/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/cookies de terceros/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/web beacons/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/direccion IP/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /como Google usa datos/i })).toHaveAttribute(
      "href",
      "https://policies.google.com/technologies/partner-sites"
    );
  });
});
