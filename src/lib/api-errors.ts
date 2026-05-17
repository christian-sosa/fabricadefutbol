export function getPublicApiErrorMessage(_error: unknown, fallbackMessage: string) {
  return fallbackMessage;
}

export function logPublicApiError(routeName: string, error: unknown) {
  if (process.env.NODE_ENV === "test") return;

  const message = error instanceof Error ? error.message : String(error);
  console.error(`[public-api] ${routeName} failed`, { message });
}
