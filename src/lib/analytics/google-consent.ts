"use client";

import { getGoogleAnalyticsMeasurementId } from "@/lib/env";

export const GOOGLE_CONSENT_STORAGE = "fdf_google_measurement_consent";
const CONSENT_EVENT = "fdf-google-consent-changed";
type GoogleConsent = "accepted" | "denied" | null;
let fallbackConsent: GoogleConsent = null;

export function getGoogleAnalyticsConsent(): GoogleConsent {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(GOOGLE_CONSENT_STORAGE);
    return value === "accepted" || value === "denied" ? value : null;
  } catch { return fallbackConsent; }
}

export function subscribeGoogleAnalyticsConsent(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(CONSENT_EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(CONSENT_EVENT, listener);
  };
}

export function setGoogleAnalyticsConsent(value: GoogleConsent) {
  fallbackConsent = value;
  try {
    if (value) window.localStorage.setItem(GOOGLE_CONSENT_STORAGE, value);
    else window.localStorage.removeItem(GOOGLE_CONSENT_STORAGE);
  } catch { /* The choice still applies for this page if storage is unavailable. */ }
  applyGoogleAnalyticsConsent(value);
  if (value !== "accepted") {
    for (const entry of document.cookie.split("; ")) {
      const name = entry.split("=")[0];
      if (/^_ga(?:_|$)/.test(name)) {
        document.cookie = `${name}=; Max-Age=0; Path=/`;
        document.cookie = `${name}=; Max-Age=0; Path=/; Domain=${window.location.hostname}`;
      }
    }
  }
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

export function applyGoogleAnalyticsConsent(value: GoogleConsent) {
  const id = getGoogleAnalyticsMeasurementId();
  if (id) {
    (window as unknown as Record<string, unknown>)[`ga-disable-${id}`] = value !== "accepted";
    try {
      window.gtag?.("consent", "update", { analytics_storage: value === "accepted" ? "granted" : "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
    } catch { /* A blocked tag never prevents changing the preference. */ }
  }
}
