"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

type Variant = "primary" | "secondary" | "ghost" | "danger";

type FormSubmitButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "children"> & {
  variant?: Variant;
  pendingLabel?: ReactNode;
  children: ReactNode;
};

/**
 * Boton de submit que se deshabilita automaticamente mientras la server action
 * esta en vuelo y muestra un texto "pending" para feedback inmediato al usuario.
 * Requiere estar dentro de un <form action={...}>.
 */
export function FormSubmitButton({
  children,
  pendingLabel,
  disabled,
  variant,
  ...props
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button
      {...props}
      aria-busy={pending || undefined}
      disabled={disabled || pending}
      type="submit"
      variant={variant}
    >
      {pending ? pendingLabel ?? "Procesando..." : children}
    </Button>
  );
}
