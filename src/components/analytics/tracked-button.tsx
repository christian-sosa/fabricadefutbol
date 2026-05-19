"use client";

import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import { trackAnalyticsEvent } from "@/lib/analytics/client";
import type { GrowthEventName } from "@/lib/growth";

type TrackedButtonProps = ComponentProps<typeof Button> & {
  eventName: GrowthEventName;
  eventProperties?: Record<string, string | number | boolean>;
};

export function TrackedButton({
  eventName,
  eventProperties,
  onClick,
  ...props
}: TrackedButtonProps) {
  return (
    <Button
      {...props}
      onClick={(event) => {
        trackAnalyticsEvent(eventName, eventProperties);
        onClick?.(event);
      }}
    />
  );
}
