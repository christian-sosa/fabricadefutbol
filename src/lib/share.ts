export type MatchWhatsAppShareParams = {
  matchUrl: string;
  teamAName?: string;
  teamBName?: string;
};

export function buildMatchWhatsAppMessage({
  matchUrl,
  teamAName = "Negro",
  teamBName = "Blanco"
}: MatchWhatsAppShareParams) {
  return [
    "⚽ Partido confirmado",
    "",
    "🔥 Equipos armados",
    `🟡 ${teamAName} vs ${teamBName}`,
    "",
    "👉 Ver jugadores y posiciones:",
    matchUrl
  ].join("\n");
}

export function buildWhatsAppShareUrl(params: MatchWhatsAppShareParams) {
  return `https://wa.me/?text=${encodeURIComponent(buildMatchWhatsAppMessage(params))}`;
}

