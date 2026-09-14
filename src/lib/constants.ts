import type { MatchModality, MatchStatus } from "@/types/domain";

export const MATCH_MODALITIES: MatchModality[] = ["5v5", "6v6", "7v7", "9v9", "11v11"];
export const MATCH_STATUSES: MatchStatus[] = ["draft", "confirmed", "finished", "cancelled"];

export const ORGANIZATION_PLAYER_PHOTO_RETENTION_DAYS = 180;

export const TEAM_SIZE_BY_MODALITY: Record<MatchModality, number> = {
  "5v5": 5,
  "6v6": 6,
  "7v7": 7,
  "9v9": 9,
  "11v11": 11
};

export const MATCH_MODALITY_LABELS: Record<MatchModality, string> = {
  "5v5": "5 vs 5",
  "6v6": "6 vs 6",
  "7v7": "7 vs 7",
  "9v9": "9 vs 9",
  "11v11": "11 vs 11"
};

export function formatMatchModality(modality: MatchModality) {
  return MATCH_MODALITY_LABELS[modality];
}

export const PUBLIC_NAV_ITEMS = [
  { href: "/", label: "Inicio" },
  { href: "/groups", label: "Grupos" },
  { href: "/ranking", label: "Ranking" },
  { href: "/matches", label: "Historial" },
  { href: "/upcoming", label: "Proximos" },
  { href: "/guides", label: "Guías" },
  { href: "/feedback", label: "Contacto" },
  { href: "/help", label: "Ayuda" }
] as const;

export const PRIMARY_PUBLIC_NAV_ITEMS = [
  { href: "/", label: "Inicio" },
  { href: "/groups", label: "Grupos" },
  { href: "/guides", label: "Guías" },
  { href: "/feedback", label: "Contacto" },
  { href: "/help", label: "Ayuda" }
] as const;

export const ORGANIZATION_PUBLIC_NAV_ITEMS = [
  { href: "/groups", label: "Grupo" },
  { href: "/ranking", label: "Ranking" },
  { href: "/matches", label: "Historial" },
  { href: "/upcoming", label: "Proximos" }
];

export const ADMIN_NAV_ITEMS = [
  { href: "/admin", label: "Grupos" }
] as const;
