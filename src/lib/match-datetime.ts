function pad(value: number) {
  return String(value).padStart(2, "0");
}

export const MATCH_TIME_ZONE = "America/Argentina/Buenos_Aires";

function getTimeZonePart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  return parts.find((part) => part.type === type)?.value ?? "00";
}

export function getCurrentMatchDateTimeIso(value: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: MATCH_TIME_ZONE,
    year: "numeric"
  }).formatToParts(value);

  const year = getTimeZonePart(parts, "year");
  const month = getTimeZonePart(parts, "month");
  const day = getTimeZonePart(parts, "day");
  const hour = getTimeZonePart(parts, "hour");
  const minute = getTimeZonePart(parts, "minute");
  const second = getTimeZonePart(parts, "second");

  return `${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`;
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
