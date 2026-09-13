"use client";
import { useActionState } from "react";
import { updateRecoveredPassword } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function ResetForm() {
  const [state, action, pending] = useActionState(updateRecoveredPassword, { error: null });
  return <form action={action} className="mt-4 space-y-3">
    <label className="block text-sm font-semibold" htmlFor="new-password">Nueva contraseña</label>
    <Input autoComplete="new-password" id="new-password" minLength={8} maxLength={128} name="password" required type="password" />
    <label className="block text-sm font-semibold" htmlFor="repeat-password">Repetir contraseña</label>
    <Input autoComplete="new-password" id="repeat-password" minLength={8} maxLength={128} name="confirmPassword" required type="password" />
    {state.error ? <p role="alert" className="text-sm text-danger">{state.error}</p> : null}
    <Button disabled={pending} type="submit">{pending ? "Guardando…" : "Guardar contraseña"}</Button>
  </form>;
}
