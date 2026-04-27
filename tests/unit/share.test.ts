import { describe, expect, it } from "vitest";

import { buildMatchWhatsAppMessage, buildWhatsAppShareUrl, getWhatsAppShareTarget } from "@/lib/share";

const shareEmojis = {
  soccer: String.fromCodePoint(0x26bd),
  fire: String.fromCodePoint(0x1f525),
  yellowCircle: String.fromCodePoint(0x1f7e1),
  pointer: String.fromCodePoint(0x1f449)
} as const;

describe("share helpers", () => {
  it("arma el mensaje de WhatsApp para un partido confirmado", () => {
    const matchUrl = "https://fabricadefutbol.com.ar/matches/abc-123";

    expect(buildMatchWhatsAppMessage({ matchUrl })).toBe(
      [
        `${shareEmojis.soccer} Partido confirmado`,
        "",
        `${shareEmojis.fire} Equipos armados`,
        `${shareEmojis.yellowCircle} Negro vs Blanco`,
        "",
        `${shareEmojis.pointer} Ver jugadores y posiciones:`,
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

    expect(shareUrl).toBe(`https://web.whatsapp.com/send?text=${encodeURIComponent(
      [
        `${shareEmojis.soccer} Partido confirmado`,
        "",
        `${shareEmojis.fire} Equipos armados`,
        `${shareEmojis.yellowCircle} Equipo A vs Equipo B`,
        "",
        `${shareEmojis.pointer} Ver jugadores y posiciones:`,
        matchUrl
      ].join("\n")
    )}`);
    expect(shareUrl).toContain("%E2%9A%BD");
    expect(shareUrl).toContain("%F0%9F%94%A5");
    expect(shareUrl).toContain("%F0%9F%9F%A1");
    expect(shareUrl).toContain("%F0%9F%91%89");
    expect(shareUrl).not.toContain("%EF%BF%BD");
  });

  it("usa deep link de WhatsApp en mobile", () => {
    const matchUrl = "https://fabricadefutbol.com.ar/matches/abc-123";

    expect(buildWhatsAppShareUrl({ matchUrl }, "mobile")).toMatch(/^whatsapp:\/\/send\?text=/);
  });

  it("detecta el destino de WhatsApp segun el navegador", () => {
    expect(getWhatsAppShareTarget("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe("mobile");
    expect(getWhatsAppShareTarget("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("web");
  });
});
