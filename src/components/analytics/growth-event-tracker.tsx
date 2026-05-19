"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { trackAnalyticsEvent } from "@/lib/analytics/client";
import {
  GROWTH_EVENT_QUERY_PARAM,
  GROWTH_EVENT_SOURCE_QUERY_PARAM,
  isGrowthEventName
} from "@/lib/growth";

export function GrowthEventTracker() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const handledEventRef = useRef<string | null>(null);

  useEffect(() => {
    const eventName = searchParams.get(GROWTH_EVENT_QUERY_PARAM);
    if (!isGrowthEventName(eventName)) return;

    const eventKey = `${pathname}:${searchParams.toString()}`;
    if (handledEventRef.current === eventKey) return;
    handledEventRef.current = eventKey;

    const source = searchParams.get(GROWTH_EVENT_SOURCE_QUERY_PARAM) ?? "query";
    trackAnalyticsEvent(eventName, { source }, { path: `${pathname}?${searchParams.toString()}` });

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete(GROWTH_EVENT_QUERY_PARAM);
    nextParams.delete(GROWTH_EVENT_SOURCE_QUERY_PARAM);
    const nextQuery = nextParams.toString().replace(/\+/g, "%20");

    router.replace(`${pathname}${nextQuery ? `?${nextQuery}` : ""}`, { scroll: false });
  }, [pathname, router, searchParams]);

  return null;
}
