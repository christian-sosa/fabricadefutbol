"use client";

import type { ButtonHTMLAttributes } from "react";

import { Button } from "@/components/ui/button";

type ConfirmSubmitButtonProps = {
  confirmMessage: string;
  label: string;
  className?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  setHiddenField?: {
    name: string;
    value: string;
  };
} & Pick<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "name" | "value" | "formAction" | "formNoValidate" | "title" | "disabled"
>;

export function ConfirmSubmitButton({
  confirmMessage,
  label,
  className,
  variant = "danger",
  setHiddenField,
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
        if (!confirmed) {
          event.preventDefault();
          return;
        }

        if (setHiddenField) {
          const form = event.currentTarget.form;
          const field = form?.elements.namedItem(setHiddenField.name);
          if (field instanceof HTMLInputElement) {
            field.value = setHiddenField.value;
          }
        }
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
