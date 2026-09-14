import type { SelectHTMLAttributes } from "react";

import { cn } from "@/lib/utils";
import { controlClass } from "@/components/ui/styles";

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full", controlClass,
        className
      )}
      {...props}
    />
  );
}
