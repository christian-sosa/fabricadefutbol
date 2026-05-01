import { DEFAULT_TEAM_A_LABEL, DEFAULT_TEAM_B_LABEL } from "@/lib/team-labels";

export type MatchWhatsAppShareParams = {
  matchUrl: string;
  teamAName?: string;
  teamBName?: string;
};

export type GroupWhatsAppShareParams = {
  groupName: string;
  groupUrl: string;
};

export type RankingWhatsAppShareParams = {
  groupName: string;
  rankingUrl: string;
};

export type WhatsAppShareTarget = "mobile" | "web";

const WHATSAPP_SHARE_EMOJIS = {
  chart: String.fromCodePoint(0x1f4ca),
  soccer: String.fromCodePoint(0x26bd),
  fire: String.fromCodePoint(0x1f525),
  matchup: String.fromCodePoint(0x2694, 0xfe0f),
  pointer: String.fromCodePoint(0x1f449),
  trophy: String.fromCodePoint(0x1f3c6)
} as const;

export function buildMatchWhatsAppMessage({
  matchUrl,
  teamAName = DEFAULT_TEAM_A_LABEL,
  teamBName = DEFAULT_TEAM_B_LABEL
}: MatchWhatsAppShareParams) {
  return [
    `${WHATSAPP_SHARE_EMOJIS.soccer} Partido confirmado`,
    "",
    `${WHATSAPP_SHARE_EMOJIS.fire} Equipos armados`,
    `${WHATSAPP_SHARE_EMOJIS.matchup} ${teamAName} vs ${teamBName}`,
    "",
    `${WHATSAPP_SHARE_EMOJIS.pointer} Ver jugadores y posiciones:`,
    matchUrl
  ].join("\n");
}

export function buildGroupWhatsAppMessage({ groupName, groupUrl }: GroupWhatsAppShareParams) {
  return [
    `${WHATSAPP_SHARE_EMOJIS.soccer} Ranking, historial y proximos partidos de ${groupName}`,
    "",
    "Mira como esta organizado el grupo en Fabrica de Futbol:",
    groupUrl
  ].join("\n");
}

export function buildRankingWhatsAppMessage({
  groupName,
  rankingUrl
}: RankingWhatsAppShareParams) {
  return [
    `${WHATSAPP_SHARE_EMOJIS.trophy} Ranking actualizado de ${groupName}`,
    "",
    `${WHATSAPP_SHARE_EMOJIS.chart} Tabla de posiciones, rendimiento y estadisticas:`,
    rankingUrl
  ].join("\n");
}

function encodeWhatsAppShareText(params: MatchWhatsAppShareParams) {
  return encodeURIComponent(buildMatchWhatsAppMessage(params));
}

function encodeMessageText(message: string) {
  return encodeURIComponent(message);
}

export function getWhatsAppShareTarget(userAgent: string) {
  return /android|iphone|ipad|ipod|mobile/i.test(userAgent) ? "mobile" : "web";
}

export function buildWhatsAppUrlFromMessage(
  message: string,
  target: WhatsAppShareTarget = "web"
) {
  const encodedText = encodeMessageText(message);
  if (target === "mobile") {
    return `whatsapp://send?text=${encodedText}`;
  }
  return `https://web.whatsapp.com/send?text=${encodedText}`;
}

export function buildWhatsAppShareUrl(
  params: MatchWhatsAppShareParams,
  target: WhatsAppShareTarget = "web"
) {
  const encodedText = encodeWhatsAppShareText(params);
  if (target === "mobile") {
    return `whatsapp://send?text=${encodedText}`;
  }
  return `https://web.whatsapp.com/send?text=${encodedText}`;
}
