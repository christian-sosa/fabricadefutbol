"use client";

import type { ButtonHTMLAttributes } from "react";

import { Button } from "@/components/ui/button";

type ConfirmSubmitButtonProps = {
  confirmMessage: string;
  label: string;
  className?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
} & Pick<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "name" | "value" | "formAction" | "formNoValidate" | "title" | "disabled"
>;

export function ConfirmSubmitButton({
  confirmMessage,
  label,
  className,
  variant = "danger",
  name,
  value,
  formAction,
  formNoValidate,
  title,
  disabled
}: ConfirmSubmitButtonProps) {
  return (
    <Button
      className={className}
      disabled={disabled}
      formAction={formAction}
      formNoValidate={formNoValidate}
      name={name}
      onClick={(event) => {
        const confirmed = window.confirm(confirmMessage);
        if (!confirmed) event.preventDefault();
      }}
      title={title}
      type="submit"
      value={value}
      variant={variant}
    >
      {label}
    </Button>
  );
}
