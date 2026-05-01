import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { WhatsAppShareButton } from "@/components/matches/whatsapp-share-button";
import { buildWhatsAppShareUrl } from "@/lib/share";

vi.mock("@vercel/analytics", () => ({
  track: vi.fn()
}));

describe("WhatsAppShareButton", () => {
  it("abre WhatsApp con el mensaje del partido", async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const { track } = await import("@vercel/analytics");
    const matchUrl = "https://fabricadefutbol.com.ar/matches/abc-123";

    render(<WhatsAppShareButton matchUrl={matchUrl} />);

    await user.click(screen.getByRole("button", { name: "Compartir en WhatsApp" }));

    expect(openSpy).toHaveBeenCalledWith(
      buildWhatsAppShareUrl({ matchUrl }, "web"),
      "_blank",
      "noopener,noreferrer"
    );
    expect(track).toHaveBeenCalledWith("match_shared", {
      source: "match_detail"
    });
  });
});
