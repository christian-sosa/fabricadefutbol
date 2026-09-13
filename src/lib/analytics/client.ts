"use client";

import { track } from "@vercel/analytics";

import { isClientAnalyticsEventName, sanitizeAnalyticsPath, sanitizeAnalyticsProperties, type ClientAnalyticsEventName, type AnalyticsProperties } from "@/lib/analytics/events";

type TrackAnalyticsOptions = {
  path?: string;
};

function getEventSource(properties: AnalyticsProperties | undefined) {
  const source = properties?.source;
  return typeof source === "string" && source.trim() ? source : "client";
}

export function trackAnalyticsEvent(
  eventName: ClientAnalyticsEventName,
  properties?: AnalyticsProperties,
  options?: TrackAnalyticsOptions
) {
  if (!isClientAnalyticsEventName(eventName)) return;
  const safeProperties = sanitizeAnalyticsProperties(properties);
  track(eventName, safeProperties);

  if (typeof window === "undefined") return;

  const path = sanitizeAnalyticsPath(options?.path ?? window.location.pathname);
  const sessionId = getAnalyticsSessionId();
  const payload = {
    eventName,
    sessionId,
    source: getEventSource(properties),
    path,
    properties: safeProperties
  };

  window
    .fetch("/api/analytics/events", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload),
      keepalive: true
    })
    .catch(() => {
      // Analytics must never interrupt the user flow.
    });
}

export function getAnalyticsSessionId() {
  try {
    const stored = window.sessionStorage.getItem("fdf_analytics_session");
    if (stored && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(stored)) return stored;
    const value = window.crypto.randomUUID();
    window.sessionStorage.setItem("fdf_analytics_session", value);
    return value;
  } catch { return undefined; }
}
