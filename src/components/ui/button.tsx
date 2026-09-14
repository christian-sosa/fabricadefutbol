import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const variantStyles = {
  primary: "bg-accent text-white hover:brightness-110",
  secondary: "border border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500 hover:bg-slate-800",
  ghost: "border border-slate-700 bg-slate-900 text-slate-100 hover:border-emerald-400/60 hover:text-emerald-300",
  danger: "bg-danger text-white hover:opacity-90"
} as const;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variantStyles;
};

export function Button({ className, variant = "primary", type = "button", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
        variantStyles[variant],
        className
      )}
      type={type}
      {...props}
    />
  );
}
