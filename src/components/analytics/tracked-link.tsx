"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

import { trackAnalyticsEvent } from "@/lib/analytics/client";
import type { ClientAnalyticsEventName } from "@/lib/analytics/events";

type TrackedLinkProps = ComponentProps<typeof Link> & {
  eventName: ClientAnalyticsEventName;
  eventProperties?: Record<string, string | number | boolean>;
};

export function TrackedLink({
  eventName,
  eventProperties,
  onClick,
  ...props
}: TrackedLinkProps) {
  return (
    <Link
      {...props}
      onClick={(event) => {
        trackAnalyticsEvent(eventName, eventProperties);
        onClick?.(event);
      }}
    />
  );
}
