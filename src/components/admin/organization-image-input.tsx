"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { prepareOrganizationImage } from "@/lib/prepare-organization-image";

export function OrganizationImageInput() {
  const id = useId();
  const sequence = useRef(0);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => () => { sequence.current += 1; }, []);
  return <div aria-busy={busy}>
    <Input accept="image/jpeg,image/png,image/webp" aria-describedby={`${id}-hint ${id}-status`} aria-invalid={Boolean(error)} aria-label="Foto de portada" name="image" required type="file" onChange={async (event) => {
      const input = event.currentTarget;
      const currentSequence = ++sequence.current;
      const file = input.files?.[0];
      setError(null); setStatus(null); input.setCustomValidity("");
      if (!file) { setBusy(false); return; }
      setBusy(true); setStatus("Preparando portada…");
      input.setCustomValidity("Esperá a que termine de prepararse la portada.");
      try {
        const prepared = await prepareOrganizationImage(file);
        if (sequence.current !== currentSequence) return;
        const transfer = new DataTransfer();
        transfer.items.add(prepared);
        input.files = transfer.files;
        input.setCustomValidity("");
        setStatus(`Portada lista para subir (${Math.max(1, Math.round(prepared.size / 1024))} KB).`);
      } catch (cause) {
        if (sequence.current !== currentSequence) return;
        const message = cause instanceof Error ? cause.message : "No pudimos preparar la portada. Probá con otra foto.";
        input.value = ""; input.setCustomValidity(message); setStatus(null); setError(message);
      } finally { if (sequence.current === currentSequence) setBusy(false); }
    }} />
    <p className="mt-1 text-xs text-slate-400" id={`${id}-hint`}>JPG, PNG o WEBP. Original hasta 20 MB; recorte horizontal al centro y compresión antes de subir, hasta 3 MB.</p>
    <p className={`mt-1 text-xs ${error ? "text-danger" : "text-emerald-300"}`} id={`${id}-status`} role={error ? "alert" : "status"}>{error ?? status}</p>
  </div>;
}
