"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { trackAnalyticsEvent } from "@/lib/analytics/client";
import { GROWTH_EVENT_QUERY_PARAM, GROWTH_EVENT_SOURCE_QUERY_PARAM, GROWTH_EVENTS } from "@/lib/growth";

export function GrowthEventTracker() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const handled = useRef<string | null>(null);
  useEffect(() => {
    const key = `${pathname}:${params.toString()}`;
    if (handled.current === key) return;
    handled.current = key;
    if (params.get("utm_source") === "whatsapp" && params.get("utm_medium") === "share" && params.get("utm_campaign") === "group_growth") {
      const content = params.get("utm_content");
      trackAnalyticsEvent(GROWTH_EVENTS.referralVisit, { source: "whatsapp", content: content && ["group", "ranking", "match"].includes(content) ? content : "other" }, { path: pathname });
    }
    // Old redirects may still contain ff_event. Clean them without recording server outcomes twice.
    if (params.has(GROWTH_EVENT_QUERY_PARAM) || params.has(GROWTH_EVENT_SOURCE_QUERY_PARAM)) {
      const next = new URLSearchParams(params.toString());
      next.delete(GROWTH_EVENT_QUERY_PARAM);
      next.delete(GROWTH_EVENT_SOURCE_QUERY_PARAM);
      router.replace(`${pathname}${next.size ? `?${next.toString()}` : ""}`, { scroll: false });
    }
  }, [pathname, router, params]);
  return null;
}
