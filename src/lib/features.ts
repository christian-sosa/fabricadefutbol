const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off"]);

export const TOURNAMENTS_PRODUCT_STAGE = "future-internal" as const;
export const CLUBS_PRODUCT_STAGE = "development-only" as const;

function parseBooleanFlag(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return null;
}

export function shouldSkipTournamentCheckoutForDebug() {
  if (process.env.NODE_ENV === "production") return false;
  const override = parseBooleanFlag(process.env.SKIP_TOURNAMENT_CHECKOUT);
  if (override !== null) return override;
  return process.env.NODE_ENV === "development";
}

export function canAccessTournamentsProduct(params: { isSuperAdmin: boolean }) {
  return TOURNAMENTS_PRODUCT_STAGE === "future-internal" && params.isSuperAdmin;
}

export function canAccessClubsProduct(environment = process.env.NODE_ENV) {
  return CLUBS_PRODUCT_STAGE === "development-only" && environment !== "production";
}

export function assertCanAccessClubsProduct(environment = process.env.NODE_ENV) {
  if (!canAccessClubsProduct(environment)) {
    throw new Error("La gestion de clubes no esta disponible.");
  }
}
