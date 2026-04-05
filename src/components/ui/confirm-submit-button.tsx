"use client";

import { Button } from "@/components/ui/button";

type ConfirmSubmitButtonProps = {
  confirmMessage: string;
  label: string;
  className?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

export function ConfirmSubmitButton({
  confirmMessage,
  label,
  className,
  variant = "danger"
}: ConfirmSubmitButtonProps) {
  return (
    <Button
      className={className}
      onClick={(event) => {
        const confirmed = window.confirm(confirmMessage);
        if (!confirmed) event.preventDefault();
      }}
      type="submit"
      variant={variant}
    >
      {label}
    </Button>
  );
}
