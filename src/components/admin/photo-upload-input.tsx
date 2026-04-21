"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";

const MAX_PHOTO_SIZE_MB = 20;
const MAX_PHOTO_SIZE_BYTES = MAX_PHOTO_SIZE_MB * 1024 * 1024;

type PhotoUploadInputProps = {
  compact?: boolean;
  hint?: string;
};

export function PhotoUploadInput({ compact = false, hint }: PhotoUploadInputProps) {
  const [error, setError] = useState<string | null>(null);
  const helperText = hint ?? `Formato recomendado: JPG/PNG. Se optimiza a WEBP (${MAX_PHOTO_SIZE_MB} MB max).`;

  return (
    <div>
      <Input
        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
        className={compact ? "px-2 py-1.5 text-xs" : undefined}
        name="photo"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (!file) {
            setError(null);
            return;
          }

          if (file.size > MAX_PHOTO_SIZE_BYTES) {
            setError(`El archivo supera ${MAX_PHOTO_SIZE_MB} MB.`);
            event.currentTarget.value = "";
            return;
          }

          setError(null);
        }}
        required
        type="file"
      />
      <p className={`mt-1 text-xs ${compact ? "leading-4" : ""} ${error ? "text-danger" : "text-slate-500"}`}>
        {error ?? helperText}
      </p>
    </div>
  );
}
