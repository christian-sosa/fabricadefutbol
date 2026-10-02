"use client";

import { sanitizeAnalyticsPath } from "@/lib/analytics/events";
import { getGoogleAnalyticsMeasurementId } from "@/lib/env";
import { getGoogleAnalyticsConsent } from "@/lib/analytics/google-consent";

type GoogleCommand = (...args: unknown[]) => void;
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: GoogleCommand;
    fdfGoogleAnalyticsId?: string;
  }
}

const GOOGLE_EVENTS = new Set(["page_view", "cta_clicked", "signup_started", "group_created", "generate_lead", "group_shared", "match_shared", "ranking_shared", "players_page_opened", "referral_visit"]);
const SAFE_PROPERTIES = new Set(["cta", "source", "content", "contact_category"]);
const sentOutcomes = new Set<string>();

export function getGooglePageContext(href: string, referrer = "") {
  try {
    const location = new URL(href);
    const pathname = location.pathname.replace(/\/$/, "") || "/";
    if (/^\/(auth|invite|api)(\/|$)/.test(pathname) || /^\/admin\/(forgot-password|reset-password)$/.test(pathname)) return null;
    const path = sanitizeAnalyticsPath(location.pathname);
    if (!path) return null;
    let safeReferrer = "";
    if (referrer) {
      try {
        const previous = new URL(referrer);
        safeReferrer = previous.origin === location.origin ? new URL(sanitizeAnalyticsPath(previous.pathname) ?? "/", previous.origin).toString() : previous.origin;
      } catch { /* Invalid referrers are omitted. */ }
    }
    return { page_location: new URL(path, location.origin).toString(), page_referrer: safeReferrer, page_title: `Fábrica de Fútbol · ${path}` };
  } catch { return null; }
}

export function initializeGoogleAnalytics() {
  const id = getGoogleAnalyticsMeasurementId();
  if (!id || typeof window === "undefined" || getGoogleAnalyticsConsent() !== "accepted") return false;
  const context = getGooglePageContext(window.location.href, document.referrer);
  if (!context) return false;
  if (window.fdfGoogleAnalyticsId === id) return true;
  window.dataLayer ??= [];
  // Google processes the Arguments object used by its documented gtag queue.
  // eslint-disable-next-line prefer-rest-params
  window.gtag ??= function () { window.dataLayer?.push(arguments); };
  try {
    window.gtag("consent", "default", { analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
    window.gtag("js", new Date());
    window.gtag("config", id, { ...context, send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false });
    window.fdfGoogleAnalyticsId = id;
    return true;
  } catch { return false; }
}

export function trackGoogleAnalyticsEvent(eventName: string, properties: Record<string, unknown> = {}, outcomeId?: string) {
  if (!GOOGLE_EVENTS.has(eventName) || !initializeGoogleAnalytics()) return false;
  const context = getGooglePageContext(window.location.href, document.referrer);
  if (!context) return false;
  if (outcomeId) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(outcomeId) || sentOutcomes.has(outcomeId)) return false;
    try {
      if (window.sessionStorage.getItem(`fdf_ga_outcome:${outcomeId}`)) return false;
      window.sessionStorage.setItem(`fdf_ga_outcome:${outcomeId}`, "1");
    } catch { /* The in-memory set still prevents duplicate effects. */ }
    sentOutcomes.add(outcomeId);
  }
  const safeProperties = Object.fromEntries(Object.entries(properties).filter(([key, value]) => SAFE_PROPERTIES.has(key) && typeof value === "string" && /^[a-z0-9_:-]{1,80}$/i.test(value)));
  try {
    window.gtag?.("event", eventName, { ...safeProperties, ...context, send_to: getGoogleAnalyticsMeasurementId() });
    return true;
  } catch { return false; }
}
