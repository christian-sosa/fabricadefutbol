import type { MatchModality, MatchStatus } from "@/types/domain";

export const MATCH_MODALITIES: MatchModality[] = ["5v5", "6v6", "7v7", "9v9", "11v11"];
export const MATCH_STATUSES: MatchStatus[] = ["draft", "confirmed", "finished", "cancelled"];

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
    if (process.env.NODE_ENV !== "test") {
      console.warn(
        "[constants] SUPER_ADMIN_EMAIL no esta definido. Ninguna cuenta obtendra privilegios de super admin."
      );
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

export const FREE_TRIAL_DAYS = 30;
export const ORGANIZATION_PLAYER_PHOTO_RETENTION_DAYS = 90;
export const ORGANIZATION_MONTHLY_PRICE_ARS = 5000;
export const TOURNAMENT_MONTHLY_DEBUG_PRICE_ARS = 100;
export const MAX_TOURNAMENT_PLAYERS_PER_TEAM = 20;
// Referencia comercial publica mientras la activacion de torneos siga en modo debug.
export const TOURNAMENT_MONTHLY_REFERENCE_PRICE_ARS = 50000;
export const ORGANIZATION_BILLING_CURRENCY = "ARS";
// Atajo temporal para debug en produccion: mantiene el flujo local de cobro
// de torneos, pero saltea el checkout externo. Volver a `false` reactiva
// Mercado Pago sin tocar la estructura del workflow.
export const TEMP_SKIP_TOURNAMENT_CHECKOUT = true;

export const TEAM_SIZE_BY_MODALITY: Record<MatchModality, number> = {
  "5v5": 5,
  "6v6": 6,
  "7v7": 7,
  "9v9": 9,
  "11v11": 11
};

export const PUBLIC_NAV_ITEMS = [
  { href: "/", label: "Inicio" },
  { href: "/groups", label: "Grupos" },
  { href: "/tournaments", label: "Torneos" },
  { href: "/ranking", label: "Ranking" },
  { href: "/matches", label: "Historial" },
  { href: "/upcoming", label: "Proximos" },
  { href: "/pricing", label: "Precios" },
  { href: "/feedback", label: "Contacto" },
  { href: "/help", label: "Ayuda" }
];

export const PRIMARY_PUBLIC_NAV_ITEMS = [
  { href: "/", label: "Inicio" },
  { href: "/groups", label: "Grupos" },
  { href: "/tournaments", label: "Torneos" },
  { href: "/pricing", label: "Precios" },
  { href: "/feedback", label: "Contacto" },
  { href: "/help", label: "Ayuda" }
];

export const ORGANIZATION_PUBLIC_NAV_ITEMS = [
  { href: "/ranking", label: "Ranking" },
  { href: "/matches", label: "Historial" },
  { href: "/upcoming", label: "Proximos" }
];

export const ADMIN_NAV_ITEMS = [
  { href: "/admin", label: "Grupos" },
  { href: "/admin/tournaments", label: "Torneos" }
];
