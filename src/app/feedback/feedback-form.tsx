"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { submitFeedbackAction } from "./actions";
import type { FeedbackState, FeedbackValues } from "./feedback-state";

export function FeedbackForm({ organization = "", intent = null }: { organization?: string; intent?: "multiple_groups" | "setup_help" | null }) {
  const initialValues: FeedbackValues = { fullName: "", email: "", category: intent ?? "sugerencia", organization, message: "" };
  const [values, setValues] = useState(initialValues);
  const [state, action, pending] = useActionState(async (previous: FeedbackState, data: FormData): Promise<FeedbackState> => {
    try { return await submitFeedbackAction(previous, data); }
    catch { return { status: "error", message: "No pudimos conectar. Tu mensaje sigue acá; volvé a intentar.", errors: {}, values }; }
  }, { status: "idle", message: null, errors: {}, values: initialValues });
  const update = (field: keyof FeedbackValues, value: string) => setValues((current) => ({ ...current, [field]: value }));
  const fieldError = (field: keyof FeedbackValues) => state.errors[field] ? <p className="mt-1 text-sm text-danger" id={`feedback-${field}-error`}>{state.errors[field]}</p> : null;
  const errorProps = (field: keyof FeedbackValues) => ({ "aria-invalid": Boolean(state.errors[field]), "aria-describedby": state.errors[field] ? `feedback-${field}-error` : undefined });

  return <form action={action} aria-busy={pending} className="space-y-4">
    <input autoComplete="off" className="hidden" name="website" tabIndex={-1} type="text" />
    {state.message ? <p className={state.status === "error" ? "text-danger" : "text-emerald-300"} role={state.status === "error" ? "alert" : "status"}>{state.message}</p> : null}
    <fieldset className="space-y-4" disabled={pending}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="mb-1 block text-sm font-semibold" htmlFor="fullName">Nombre</label><Input {...errorProps("fullName")} autoComplete="name" id="fullName" maxLength={80} name="fullName" onChange={(event) => update("fullName", event.target.value)} required value={values.fullName} />{fieldError("fullName")}</div>
        <div><label className="mb-1 block text-sm font-semibold" htmlFor="email">Email</label><Input {...errorProps("email")} autoComplete="email" id="email" maxLength={254} name="email" onChange={(event) => update("email", event.target.value)} required type="email" value={values.email} />{fieldError("email")}</div>
      </div>
      <div><label className="mb-1 block text-sm font-semibold" htmlFor="category">Motivo</label><Select {...errorProps("category")} id="category" name="category" onChange={(event) => update("category", event.target.value)} value={values.category}>
        <option value="multiple_groups">Administrar varios grupos</option><option value="setup_help">Ayuda para la carga inicial</option>
        <option value="sugerencia">Sugerencia</option><option value="queja">Queja</option><option value="error">Reporte de error</option><option value="otro">Otra consulta</option>
      </Select>{fieldError("category")}</div>
      <div><label className="mb-1 block text-sm font-semibold" htmlFor="organization">Grupo (opcional)</label><Input {...errorProps("organization")} id="organization" maxLength={80} name="organization" onChange={(event) => update("organization", event.target.value)} value={values.organization} />{fieldError("organization")}</div>
      <div><label className="mb-1 block text-sm font-semibold" htmlFor="message">Mensaje</label><Textarea {...errorProps("message")} id="message" maxLength={2500} minLength={10} name="message" onChange={(event) => update("message", event.target.value)} placeholder={intent === "multiple_groups" ? "Cuántos grupos son, cuántas veces juegan y qué necesitás organizar…" : intent === "setup_help" ? "Cantidad aproximada de jugadores y partidos, formato actual y ayuda que necesitás…" : "Contanos en qué podemos ayudarte…"} required rows={7} value={values.message} />{fieldError("message")}</div>
    </fieldset>
    <p className="text-xs text-slate-400">No adjuntes contraseñas, diagnósticos ni datos sensibles. La solicitud no genera cobros ni habilita grupos automáticamente.</p>
    <Button disabled={pending} type="submit">{pending ? "Enviando…" : state.status === "error" ? "Reintentar envío" : "Enviar mensaje"}</Button>
  </form>;
}
