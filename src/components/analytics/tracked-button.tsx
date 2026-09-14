"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { trackAnalyticsEvent } from "@/lib/analytics/client";
import type { ClientAnalyticsEventName } from "@/lib/analytics/events";

type TrackedButtonProps = ComponentProps<typeof Button> & {
  eventName: ClientAnalyticsEventName;
  eventProperties?: Record<string, string | number | boolean>;
  pendingLabel?: string;
};

export function TrackedButton({
  eventName,
  eventProperties,
  onClick,
  pendingLabel,
  ...props
}: TrackedButtonProps) {
  const { pending } = useFormStatus();
  const submitting = props.type === "submit" && pending;
  return (
    <Button
      {...props}
      disabled={props.disabled || submitting}
      aria-busy={submitting || undefined}
      onClick={(event) => {
        trackAnalyticsEvent(eventName, eventProperties);
        onClick?.(event);
      }}
    >
      {submitting ? pendingLabel ?? "Procesando…" : props.children}
    </Button>
  );
}
