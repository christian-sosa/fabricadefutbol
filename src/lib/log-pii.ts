// Helpers para redactar PII (datos personales) antes de volcarlos a logs.
// La idea es mantener las entradas utiles para debugging (por ejemplo, saber
// que "algun usuario fallo") sin exponer el email ni el userId crudos en
// nuestros logs agregados.

export function maskEmail(email: string | null | undefined): string {
  if (!email) return "";
  const normalized = email.trim().toLowerCase();
  const atIndex = normalized.indexOf("@");
  if (atIndex <= 0) {
    if (normalized.length <= 2) return "***";
    return `${normalized[0]}***`;
  }
  const local = normalized.slice(0, atIndex);
  const domain = normalized.slice(atIndex + 1);
  const safeLocal =
    local.length <= 2
      ? `${local[0] ?? "*"}***`
      : `${local[0]}***${local[local.length - 1]}`;
  return `${safeLocal}@${domain}`;
}

export function maskUserId(userId: string | null | undefined): string {
  if (!userId) return "";
  const trimmed = userId.trim();
  if (trimmed.length <= 8) return "***";
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}
