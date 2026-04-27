import { describe, expect, it } from "vitest";

import { buildMatchWhatsAppMessage, buildWhatsAppShareUrl } from "@/lib/share";

describe("share helpers", () => {
  it("arma el mensaje de WhatsApp para un partido confirmado", () => {
    const matchUrl = "https://fabricadefutbol.com.ar/matches/abc-123";

    expect(buildMatchWhatsAppMessage({ matchUrl })).toBe(
      [
        "⚽ Partido confirmado",
        "",
        "🔥 Equipos armados",
        "🟡 Negro vs Blanco",
        "",
        "👉 Ver jugadores y posiciones:",
        matchUrl
      ].join("\n")
    );
  });

  it("codifica el mensaje dentro de la URL de WhatsApp", () => {
    const matchUrl = "https://fabricadefutbol.com.ar/matches/abc-123?org=liga%20a";
    const shareUrl = buildWhatsAppShareUrl({
      matchUrl,
      teamAName: "Equipo A",
      teamBName: "Equipo B"
    });

    expect(shareUrl).toBe(`https://wa.me/?text=${encodeURIComponent(
      [
        "⚽ Partido confirmado",
        "",
        "🔥 Equipos armados",
        "🟡 Equipo A vs Equipo B",
        "",
        "👉 Ver jugadores y posiciones:",
        matchUrl
      ].join("\n")
    )}`);
    expect(shareUrl).toContain("%E2%9A%BD");
    expect(shareUrl).toContain("%F0%9F%94%A5");
    expect(shareUrl).toContain("%F0%9F%9F%A1");
    expect(shareUrl).toContain("%F0%9F%91%89");
    expect(shareUrl).not.toContain("%EF%BF%BD");
  });
});
