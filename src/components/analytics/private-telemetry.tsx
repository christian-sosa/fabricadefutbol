"use client";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { sanitizeAnalyticsPath } from "@/lib/analytics/events";

function beforeSend<T extends { url: string }>(event: T): T | null {
  const path = sanitizeAnalyticsPath(event.url);
  if (!path || /^\/(auth|invite)(\/|$)/.test(path) || path === "/admin/reset-password" || path === "/admin/forgot-password") return null;
  try {
    return { ...event, url: new URL(path, new URL(event.url, window.location.origin).origin).toString() };
  } catch { return null; }
}

export function PrivateTelemetry({ speedInsightsEnabled }: { speedInsightsEnabled: boolean }) {
  return <><Analytics beforeSend={beforeSend} />{speedInsightsEnabled ? <SpeedInsights beforeSend={beforeSend} /> : null}</>;
}
