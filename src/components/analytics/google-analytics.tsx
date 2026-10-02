"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { getGoogleAnalyticsMeasurementId } from "@/lib/env";
import { getGooglePageContext, initializeGoogleAnalytics, trackGoogleAnalyticsEvent } from "@/lib/analytics/google";
import { GOOGLE_OUTCOME_COOKIE, parseGoogleOutcome } from "@/lib/analytics/google-outcome";
import { applyGoogleAnalyticsConsent, getGoogleAnalyticsConsent, setGoogleAnalyticsConsent, subscribeGoogleAnalyticsConsent } from "@/lib/analytics/google-consent";

export function GoogleAnalytics() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);
  const measurementId = getGoogleAnalyticsMeasurementId();
  const consent = useSyncExternalStore(subscribeGoogleAnalyticsConsent, getGoogleAnalyticsConsent, () => null);
  useEffect(() => {
    if (!measurementId) return;
    const measurablePage = getGooglePageContext(window.location.href);
    applyGoogleAnalyticsConsent(measurablePage ? consent : null);
    if (consent !== "accepted") {
      // Outcomes that happened before acceptance are discarded, never replayed later.
      document.cookie = `${GOOGLE_OUTCOME_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
      lastPath.current = null;
      return;
    }
    if (!measurablePage || !initializeGoogleAnalytics()) return;
    if (lastPath.current !== pathname) {
      lastPath.current = pathname;
      trackGoogleAnalyticsEvent("page_view");
    }
    const cookie = document.cookie.split("; ").find((entry) => entry.startsWith(`${GOOGLE_OUTCOME_COOKIE}=`));
    const outcome = parseGoogleOutcome(cookie?.slice(GOOGLE_OUTCOME_COOKIE.length + 1));
    if (outcome) {
      trackGoogleAnalyticsEvent(outcome.eventName, {}, outcome.outcomeId);
      document.cookie = `${GOOGLE_OUTCOME_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
    }
  }, [measurementId, pathname, consent]);
  if (!measurementId || !getGooglePageContext(`https://local.invalid${pathname}`)) return null;
  if (!consent) return <aside aria-label="Medición de visitas" className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-2xl rounded-xl border border-slate-600 bg-slate-950 p-4 shadow-xl">
    <p className="text-sm leading-relaxed text-slate-200">¿Nos permitís medir visitas y acciones para mejorar Fábrica de Fútbol? Es opcional y no usamos esta medición para anuncios. <a className="font-semibold text-accent underline" href="/privacy">Ver privacidad</a></p>
    <div className="mt-3 flex flex-wrap gap-3">
      <button className="min-h-11 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground" onClick={() => setGoogleAnalyticsConsent("accepted")} type="button">Aceptar medición</button>
      <button className="min-h-11 rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-100" onClick={() => setGoogleAnalyticsConsent("denied")} type="button">No aceptar</button>
    </div>
  </aside>;
  const preferences = pathname === "/privacy" ? <div className="mx-auto max-w-6xl px-4 pb-6"><button className="min-h-11 text-sm font-semibold text-accent underline" onClick={() => setGoogleAnalyticsConsent(null)} type="button">Cambiar preferencia de medición</button></div> : null;
  if (consent !== "accepted") return preferences;
  return <>{preferences}<Script id="fdf-google-tag" src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="afterInteractive" /></>;
}
