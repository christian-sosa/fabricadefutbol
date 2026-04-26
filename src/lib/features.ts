const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off"]);

export const TOURNAMENTS_DISABLED_ADMIN_MESSAGE = "El modulo Torneos no esta disponible todavia.";

function parseBooleanFlag(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return null;
}

export function isTournamentsEnabled() {
  const override = parseBooleanFlag(process.env.NEXT_PUBLIC_TOURNAMENTS_ENABLED);
  if (override !== null) return override;
  return process.env.NODE_ENV !== "production";
}

export function shouldSkipTournamentCheckoutForDebug() {
  return process.env.NODE_ENV === "development";
}
