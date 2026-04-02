import { type ClassValue, clsx } from "clsx";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateTime(value: string | Date) {
  const parsed = typeof value === "string" ? new Date(value) : value;
  return format(parsed, "dd/MM/yyyy HH:mm", { locale: es });
}

export function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

export function toNumber(value: FormDataEntryValue | null, fallback = 0) {
  if (typeof value !== "string") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
