"use client";

import { useActionState, useLayoutEffect, useId, useRef, type ComponentProps } from "react";
import type { FormActionResult } from "@/lib/form-action-result";
import { isNextRedirectError } from "@/lib/next-redirect";

type Props = Omit<ComponentProps<"form">, "action"> & { action: (data: FormData) => Promise<FormActionResult> };

export function ActionForm({ action, children, ...props }: Props) {
  const preserve = useRef(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const errorId = useId();
  const restoreValues = useRef<() => void>(() => {});
  const [state, formAction, pending] = useActionState(async (_: FormActionResult, data: FormData) => {
    // React can request a native reset as soon as the action starts, before its result arrives.
    preserve.current = true;
    let result: FormActionResult;
    try { result = await action(data); }
    catch (error) {
      if (isNextRedirectError(error)) throw error;
      result = { error: "No pudimos confirmar el guardado. Conservamos tus datos; revisá la conexión y comprobá si se guardó antes de volver a intentar." };
    }
    preserve.current = Boolean(result?.error);
    return result ?? { error: null };
  }, { error: null });
  useLayoutEffect(() => {
    if (state.error) { restoreValues.current(); errorRef.current?.focus(); }
  }, [state]);

  return <form {...props} action={formAction} aria-busy={pending} aria-describedby={state.error ? errorId : undefined} onSubmit={(event) => {
    const restorers = Array.from(event.currentTarget.elements).flatMap((element) => {
      if (element instanceof HTMLInputElement) {
        const { value, checked, files } = element;
        return [() => { if (element.type === "file") { if (files?.length && !element.files?.length) element.files = files; } else { element.value = value; element.checked = checked; } }];
      }
      if (element instanceof HTMLSelectElement) {
        const selected = Array.from(element.options).map((option) => option.selected);
        return [() => { Array.from(element.options).forEach((option, index) => { option.selected = selected[index]; }); }];
      }
      if (element instanceof HTMLTextAreaElement) { const value = element.value; return [() => { element.value = value; }]; }
      return [];
    });
    restoreValues.current = () => { restorers.forEach((restore) => restore()); };
    props.onSubmit?.(event);
  }} onReset={(event) => { if (preserve.current) event.preventDefault(); }}>
    {children}
    {state.error ? <p className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger" id={errorId} ref={errorRef} role="alert" tabIndex={-1}>{state.error}</p> : null}
  </form>;
}
