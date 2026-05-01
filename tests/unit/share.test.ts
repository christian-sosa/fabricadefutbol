import { describe, expect, it } from "vitest";

import {
  buildGroupWhatsAppMessage,
  buildMatchWhatsAppMessage,
  buildRankingWhatsAppMessage,
  buildWhatsAppShareUrl,
  getWhatsAppShareTarget
} from "@/lib/share";

const shareEmojis = {
  soccer: String.fromCodePoint(0x26bd),
  fire: String.fromCodePoint(0x1f525),
  matchup: String.fromCodePoint(0x2694, 0xfe0f),
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
        `${shareEmojis.matchup} Negro vs Blanco`,
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
        `${shareEmojis.matchup} Equipo A vs Equipo B`,
        "",
        `${shareEmojis.pointer} Ver jugadores y posiciones:`,
        matchUrl
      ].join("\n")
    )}`);
    expect(shareUrl).toContain("%E2%9A%BD");
    expect(shareUrl).toContain("%F0%9F%94%A5");
    expect(shareUrl).toContain("%E2%9A%94%EF%B8%8F");
    expect(shareUrl).toContain("%F0%9F%91%89");
    expect(shareUrl).not.toContain("%EF%BF%BD");
  });

  it("usa deep link de WhatsApp en mobile", () => {
    const matchUrl = "https://fabricadefutbol.com.ar/matches/abc-123";

    expect(buildWhatsAppShareUrl({ matchUrl }, "mobile")).toMatch(/^whatsapp:\/\/send\?text=/);
  });

  it("arma el mensaje para compartir la pagina publica del grupo", () => {
    expect(
      buildGroupWhatsAppMessage({
        groupName: "Los Pibes",
        groupUrl: "https://fabricadefutbol.com.ar/groups?org=los-pibes"
      })
    ).toContain("Ranking, historial y proximos partidos de Los Pibes");
  });

  it("arma el mensaje para compartir el ranking del grupo", () => {
    expect(
      buildRankingWhatsAppMessage({
        groupName: "Los Pibes",
        rankingUrl: "https://fabricadefutbol.com.ar/ranking?org=los-pibes"
      })
    ).toContain("Ranking actualizado de Los Pibes");
  });

  it("detecta el destino de WhatsApp segun el navegador", () => {
    expect(getWhatsAppShareTarget("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe("mobile");
    expect(getWhatsAppShareTarget("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("web");
  });
});
