"use client";

import { track } from "@vercel/analytics";
import Link from "next/link";
import type { ComponentProps } from "react";

import type { GrowthEventName } from "@/lib/growth";

type TrackedLinkProps = ComponentProps<typeof Link> & {
  eventName: GrowthEventName;
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
        track(eventName, eventProperties);
        onClick?.(event);
      }}
    />
  );
}
