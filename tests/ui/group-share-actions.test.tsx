import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { GroupShareActions } from "@/components/groups/group-share-actions";
import {
  buildRankingWhatsAppMessage,
  buildWhatsAppUrlFromMessage
} from "@/lib/share";

vi.mock("@vercel/analytics", () => ({
  track: vi.fn()
}));

describe("GroupShareActions", () => {
  it("comparte el ranking por WhatsApp y trackea el evento", async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const { track } = await import("@vercel/analytics");
    const rankingUrl = "https://fabricadefutbol.com.ar/ranking?org=los-pibes&utm_source=whatsapp";

    render(
      <GroupShareActions
        groupName="Los Pibes"
        rankingUrl={rankingUrl}
        source="ranking_page"
      />
    );

    await user.click(screen.getByRole("button", { name: "Compartir ranking" }));

    expect(openSpy).toHaveBeenCalledWith(
      buildWhatsAppUrlFromMessage(
        buildRankingWhatsAppMessage({
          groupName: "Los Pibes",
          rankingUrl
        }),
        "web"
      ),
      "_blank",
      "noopener,noreferrer"
    );
    expect(track).toHaveBeenCalledWith("ranking_shared", {
      source: "ranking_page"
    });
  });
});
