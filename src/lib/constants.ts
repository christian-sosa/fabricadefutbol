import type { MatchModality, MatchStatus } from "@/types/domain";

export const MATCH_MODALITIES: MatchModality[] = ["5v5", "6v6", "7v7"];
export const MATCH_STATUSES: MatchStatus[] = ["draft", "confirmed", "finished", "cancelled"];

export const TEAM_SIZE_BY_MODALITY: Record<MatchModality, number> = {
  "5v5": 5,
  "6v6": 6,
  "7v7": 7
};

export const PUBLIC_NAV_ITEMS = [
  { href: "/", label: "Inicio" },
  { href: "/ranking", label: "Ranking" },
  { href: "/players", label: "Jugadores" },
  { href: "/matches", label: "Historial" },
  { href: "/upcoming", label: "Próximos" },
  { href: "/demo", label: "Demo" }
];

export const ADMIN_NAV_ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/players", label: "Jugadores" },
  { href: "/admin/matches/new", label: "Nuevo Partido" }
];
