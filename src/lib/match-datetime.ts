function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function datetimeLocalToMatchIso(value: string) {
  const normalized = value.trim();
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?$/.exec(normalized);

  if (match) {
    const seconds = match[3] ?? "00";
    return `${match[1]}T${match[2]}:${seconds}.000Z`;
  }

  return new Date(normalized).toISOString();
}

export function matchIsoToDatetimeLocal(value: string | null | undefined) {
  if (!value) return "";
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value.trim());
  if (match) return `${match[1]}T${match[2]}`;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return `${parsed.getUTCFullYear()}-${pad(parsed.getUTCMonth() + 1)}-${pad(parsed.getUTCDate())}T${pad(parsed.getUTCHours())}:${pad(parsed.getUTCMinutes())}`;
}

export function formatMatchDateTime(value: string | Date) {
  const parsed = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(parsed.getTime())) return "-";

  return `${pad(parsed.getUTCDate())}/${pad(parsed.getUTCMonth() + 1)}/${parsed.getUTCFullYear()} ${pad(parsed.getUTCHours())}:${pad(parsed.getUTCMinutes())}`;
}
