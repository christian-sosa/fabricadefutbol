"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";

const MAX_PHOTO_SIZE_MB = 20;
const MAX_PHOTO_SIZE_BYTES = MAX_PHOTO_SIZE_MB * 1024 * 1024;

export function PhotoUploadInput() {
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <Input
        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
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
      <p className={`mt-1 text-xs ${error ? "text-danger" : "text-slate-500"}`}>
        {error ?? `Formato recomendado: JPG/PNG. Se optimiza a WEBP (${MAX_PHOTO_SIZE_MB} MB max).`}
      </p>
    </div>
  );
}
