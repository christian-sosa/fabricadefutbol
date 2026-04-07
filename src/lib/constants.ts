import type { MatchModality, MatchStatus } from "@/types/domain";

export const MATCH_MODALITIES: MatchModality[] = ["5v5", "6v6", "7v7", "9v9", "11v11"];
export const MATCH_STATUSES: MatchStatus[] = ["draft", "confirmed", "finished", "cancelled"];
export const SUPER_ADMIN_EMAIL = "sosa.christian.agustin@gmail.com";
export const FREE_TRIAL_DAYS = 30;
export const ORGANIZATION_MONTHLY_PRICE_ARS = 5000;
export const ORGANIZATION_BILLING_CURRENCY = "ARS";

export const TEAM_SIZE_BY_MODALITY: Record<MatchModality, number> = {
  "5v5": 5,
  "6v6": 6,
  "7v7": 7,
  "9v9": 9,
  "11v11": 11
};

export const PUBLIC_NAV_ITEMS = [
  { href: "/", label: "Inicio" },
  { href: "/ranking", label: "Ranking" },
  { href: "/players", label: "Jugadores" },
  { href: "/matches", label: "Historial" },
  { href: "/upcoming", label: "Proximos" },
  { href: "/pricing", label: "Precios" },
  { href: "/feedback", label: "Contacto" },
  { href: "/help", label: "Ayuda" }
];

export const ADMIN_NAV_ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/players", label: "Jugadores" },
  { href: "/admin/matches/new", label: "Nuevo Partido" },
  { href: "/admin/billing", label: "Facturacion" }
];
