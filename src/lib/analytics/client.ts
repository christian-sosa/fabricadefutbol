"use client";

import { track } from "@vercel/analytics";

import { type AnalyticsEventName, type AnalyticsProperties } from "@/lib/analytics/events";

type TrackAnalyticsOptions = {
  path?: string;
};

function getEventSource(properties: AnalyticsProperties | undefined) {
  const source = properties?.source;
  return typeof source === "string" && source.trim() ? source : "client";
}

export function trackAnalyticsEvent(
  eventName: AnalyticsEventName,
  properties?: AnalyticsProperties,
  options?: TrackAnalyticsOptions
) {
  track(eventName, properties);

  if (typeof window === "undefined") return;

  const path = options?.path ?? `${window.location.pathname}${window.location.search}`;
  const payload = {
    eventName,
    source: getEventSource(properties),
    path,
    properties: properties ?? {}
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
