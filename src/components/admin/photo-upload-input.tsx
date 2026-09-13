"use client";

import { useEffect, useId, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { MAX_PLAYER_PHOTO_SIZE_MB, MAX_PLAYER_PHOTO_SOURCE_SIZE_MB } from "@/lib/photo-constraints";
import { preparePlayerPhoto } from "@/lib/prepare-player-photo";

type PhotoUploadInputProps = { compact?: boolean; hint?: string; required?: boolean };

export function PhotoUploadInput({ compact = false, hint, required = true }: PhotoUploadInputProps) {
  const id = useId();
  const sequence = useRef(0);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => () => { sequence.current += 1; }, []);

  return (
    <div className={compact ? "min-w-0" : undefined} aria-busy={busy}>
      <Input
        id={id}
        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
        aria-describedby={`${id}-hint ${id}-status`}
        aria-invalid={Boolean(error)}
        aria-label="Foto del jugador"
        className={compact ? "h-[38px] min-w-0 px-2 py-1.5 text-xs" : undefined}
        name="photo"
        onChange={async (event) => {
          const input = event.currentTarget;
          const currentSequence = ++sequence.current;
          const file = input.files?.[0];
          setError(null);
          setStatus(null);
          input.setCustomValidity("");
          if (!file) { setBusy(false); return; }
          setBusy(true);
          setStatus("Preparando foto…");
          input.setCustomValidity("Esperá a que termine de prepararse la foto.");
          try {
            const prepared = await preparePlayerPhoto(file);
            if (sequence.current !== currentSequence) return;
            const transfer = new DataTransfer();
            transfer.items.add(prepared);
            input.files = transfer.files;
            input.setCustomValidity("");
            setStatus(`Foto lista para subir (${Math.max(1, Math.round(prepared.size / 1024))} KB).`);
          } catch (cause) {
            if (sequence.current !== currentSequence) return;
            const message = cause instanceof Error ? cause.message : "No pudimos preparar la foto. Probá con otra imagen.";
            input.value = "";
            input.setCustomValidity(message);
            setStatus(null);
            setError(message);
          } finally {
            if (sequence.current === currentSequence) setBusy(false);
          }
        }}
        required={required}
        type="file"
      />
      <p className="mt-1 text-xs leading-4 text-slate-500" id={`${id}-hint`}>
        {hint ? `${hint} ` : "JPG, PNG o WEBP. "}
        Original hasta {MAX_PLAYER_PHOTO_SOURCE_SIZE_MB} MB; se recorta al centro y comprime antes de subir. Máximo preparado: {MAX_PLAYER_PHOTO_SIZE_MB} MB.
      </p>
      <p aria-live="polite" className={`mt-1 text-xs ${error ? "text-danger" : "text-emerald-300"}`} id={`${id}-status`} role={error ? "alert" : "status"}>
        {error ?? status}
      </p>
      {(busy || status || error) && !required ? (
        <button className="mt-1 text-xs text-slate-300 underline" type="button" onClick={() => {
          sequence.current += 1;
          const input = document.getElementById(id) as HTMLInputElement | null;
          if (input) { input.value = ""; input.setCustomValidity(""); }
          setBusy(false);
          setStatus(null);
          setError(null);
        }}>
          Continuar sin foto
        </button>
      ) : null}
    </div>
  );
}
