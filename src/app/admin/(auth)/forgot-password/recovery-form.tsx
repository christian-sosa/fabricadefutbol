"use client";
import { useActionState } from "react";
import { requestPasswordRecovery } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function RecoveryForm() {
  const [state, action, pending] = useActionState(requestPasswordRecovery, { error: null, success: null });
  return <form action={action} className="mt-4 space-y-3">
    <label className="block text-sm font-semibold" htmlFor="recovery-email">Email de tu cuenta</label>
    <Input autoComplete="email" id="recovery-email" name="email" required type="email" />
    {state.error ? <p role="alert" className="text-sm text-danger">{state.error}</p> : null}
    {state.success ? <p role="status" className="text-sm text-emerald-300">{state.success}</p> : null}
    <Button disabled={pending} type="submit">{pending ? "Solicitando…" : "Enviar enlace de recuperación"}</Button>
  </form>;
}
