import type { TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils";
import { controlClass } from "@/components/ui/styles";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full", controlClass,
        className
      )}
      {...props}
    />
  );
}
