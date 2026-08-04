import type { MatchModality, MatchStatus } from "@/types/domain";

import { canAccessClubsProduct, shouldSkipTournamentCheckoutForDebug } from "@/lib/features";

export const MATCH_MODALITIES: MatchModality[] = ["5v5", "6v6", "7v7", "9v9", "11v11"];
export const MATCH_STATUSES: MatchStatus[] = ["draft", "confirmed", "finished", "cancelled"];

const MISSING_SUPER_ADMIN_WARNING_FLAG = "__fdf_missing_super_admin_warning_logged__";

function warnMissingSuperAdminEmailOnce() {
  const globalState = globalThis as typeof globalThis & Record<string, boolean | undefined>;
  if (globalState[MISSING_SUPER_ADMIN_WARNING_FLAG]) return;
  globalState[MISSING_SUPER_ADMIN_WARNING_FLAG] = true;
  console.warn(
    "[constants] SUPER_ADMIN_EMAIL no esta definido. Ninguna cuenta obtendra privilegios de super admin."
  );
}

function shouldWarnMissingSuperAdminEmail() {
  return process.env.NODE_ENV !== "test" && process.env.npm_lifecycle_event !== "build";
}

// Email del super admin. Se resuelve unicamente desde la env `SUPER_ADMIN_EMAIL`
// (solo servidor, nunca se expone al bundle cliente). Si la variable no esta
// definida, ninguna cuenta obtiene privilegios de super admin y registramos una
// advertencia en server logs para facilitar el diagnostico. Esta eleccion es
// segura-por-defecto: preferimos no super-admin a uno hardcodeado en el repo.
function resolveSuperAdminEmail(): string {
  const isServer = typeof window === "undefined";
  if (!isServer) {
    // En cliente nunca tenemos acceso a esta variable. Retornamos "" para que
    // cualquier comparacion `email === SUPER_ADMIN_EMAIL` de false.
    return "";
  }
  const raw = (typeof process !== "undefined" ? process.env.SUPER_ADMIN_EMAIL : undefined)?.trim().toLowerCase();
  if (!raw) {
    if (shouldWarnMissingSuperAdminEmail()) {
      warnMissingSuperAdminEmailOnce();
    }
    return "";
  }
  return raw;
}

export const SUPER_ADMIN_EMAIL = resolveSuperAdminEmail();

/** `true` si hay un super admin configurado via env. Util para evitar ramas
 * que dependan de privilegios elevados cuando el setup es incompleto. */
export function isSuperAdminConfigured() {
  return SUPER_ADMIN_EMAIL.length > 0;
}

export const ORGANIZATION_PLAYER_PHOTO_RETENTION_DAYS = 180;
export const TOURNAMENT_MONTHLY_DEBUG_PRICE_ARS = 100;
export const MAX_TOURNAMENT_PLAYERS_PER_TEAM = 20;
export const TOURNAMENT_MONTHLY_REFERENCE_PRICE_ARS = 50000;
export const BILLING_CURRENCY = "ARS";

function resolveTournamentMonthlyPriceArs() {
  const raw = process.env.TOURNAMENT_MONTHLY_PRICE_ARS?.trim();
  if (!raw) return TOURNAMENT_MONTHLY_REFERENCE_PRICE_ARS;

  const parsed = Number(raw);
  if (Number.isInteger(parsed) && parsed > 0) return parsed;

  if (process.env.NODE_ENV !== "test") {
    console.warn(
      "[constants] TOURNAMENT_MONTHLY_PRICE_ARS invalido. Se usa el precio mensual de referencia."
    );
  }
  return TOURNAMENT_MONTHLY_REFERENCE_PRICE_ARS;
}

export const TOURNAMENT_MONTHLY_PRICE_ARS = resolveTournamentMonthlyPriceArs();
// Atajo temporal solo para desarrollo local: mantiene el flujo de torneos
// testeable sin checkout externo. En produccion Mercado Pago queda activo.
export const TEMP_SKIP_TOURNAMENT_CHECKOUT = shouldSkipTournamentCheckoutForDebug();
export const TOURNAMENT_MONTHLY_CHECKOUT_PRICE_ARS = TEMP_SKIP_TOURNAMENT_CHECKOUT
  ? TOURNAMENT_MONTHLY_DEBUG_PRICE_ARS
  : TOURNAMENT_MONTHLY_PRICE_ARS;

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
  ...(canAccessClubsProduct() ? [{ href: "/clubs", label: "Clubes" }] : []),
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
  ...(canAccessClubsProduct() ? [{ href: "/clubs", label: "Clubes" }] : []),
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
  { href: "/admin", label: "Grupos" },
  { href: "/admin/tournaments", label: "Torneos" }
] as const;
