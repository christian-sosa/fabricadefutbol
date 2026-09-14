import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";
import { controlClass } from "@/components/ui/styles";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full", controlClass,
        className
      )}
      {...props}
    />
  );
}
