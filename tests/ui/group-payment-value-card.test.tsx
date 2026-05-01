import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GroupPaymentValueCard } from "@/components/admin/group-payment-value-card";

vi.mock("@vercel/analytics", () => ({
  track: vi.fn()
}));

describe("GroupPaymentValueCard", () => {
  it("muestra CTA de pago cuando el trial esta cerca de vencer", () => {
    render(
      <GroupPaymentValueCard
        accessValidUntil="2026-05-03T00:00:00.000Z"
        canWrite
        finishedCount={3}
        organizationSlug="la-cantera"
        playersCount={16}
        subscriptionActive={false}
        totalMatches={5}
        variant="dashboard"
      />
    );

    expect(screen.getByText("Tu grupo ya tiene valor acumulado")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Activar plan mensual" })).toHaveAttribute(
      "href",
      "/admin/billing?org=la-cantera"
    );
  });
});
