import { DEFAULT_TEAM_A_LABEL, DEFAULT_TEAM_B_LABEL } from "@/lib/team-labels";

export type MatchWhatsAppShareParams = {
  matchUrl: string;
  teamAName?: string;
  teamBName?: string;
};

const WHATSAPP_SHARE_EMOJIS = {
  soccer: String.fromCodePoint(0x26bd),
  fire: String.fromCodePoint(0x1f525),
  yellowCircle: String.fromCodePoint(0x1f7e1),
  pointer: String.fromCodePoint(0x1f449)
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
    `${WHATSAPP_SHARE_EMOJIS.yellowCircle} ${teamAName} vs ${teamBName}`,
    "",
    `${WHATSAPP_SHARE_EMOJIS.pointer} Ver jugadores y posiciones:`,
    matchUrl
  ].join("\n");
}

export function buildWhatsAppShareUrl(params: MatchWhatsAppShareParams) {
  return `https://wa.me/?text=${encodeURIComponent(buildMatchWhatsAppMessage(params))}`;
}
