import { formatMatchDateTime } from "@/lib/match-datetime";

const matchDateFormatter = new Intl.DateTimeFormat("es-AR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  // Match timestamps store the sporting wall-clock time in their UTC fields.
  // Keep the same date and hour as formatMatchDateTime, without another timezone conversion.
  timeZone: "UTC"
});

export function MatchDateTime({ value, className }: { value: string; className?: string }) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return <span className={className}>Fecha por confirmar</span>;

  return <time className={className} dateTime={value} title={formatMatchDateTime(value)}>{matchDateFormatter.format(parsed)}</time>;
}
