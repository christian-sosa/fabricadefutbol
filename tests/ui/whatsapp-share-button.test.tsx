import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { WhatsAppShareButton } from "@/components/matches/whatsapp-share-button";
import { buildWhatsAppShareUrl } from "@/lib/share";

describe("WhatsAppShareButton", () => {
  it("abre WhatsApp con el mensaje del partido", async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const matchUrl = "https://fabricadefutbol.com.ar/matches/abc-123";

    render(<WhatsAppShareButton matchUrl={matchUrl} />);

    await user.click(screen.getByRole("button", { name: "Compartir en WhatsApp" }));

    expect(openSpy).toHaveBeenCalledWith(
      buildWhatsAppShareUrl({ matchUrl }),
      "_blank",
      "noopener,noreferrer"
    );
  });
});

