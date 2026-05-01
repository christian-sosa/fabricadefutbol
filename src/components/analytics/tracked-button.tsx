"use client";

import { track } from "@vercel/analytics";
import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";
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
        track(eventName, eventProperties);
        onClick?.(event);
      }}
    />
  );
}
