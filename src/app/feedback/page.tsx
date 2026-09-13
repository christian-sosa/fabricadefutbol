import Link from "next/link";
import { submitFeedbackAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<{ org?: string; intent?: string; sent?: string; error?: string }> }) {
  const params = await searchParams;
  const intent = params.intent === "multiple_groups" || params.intent === "setup_help" ? params.intent : null;
  const title = intent === "multiple_groups" ? "Necesito administrar varios grupos" : intent === "setup_help" ? "Ayuda para la carga inicial" : "Contacto";
  const description = intent === "multiple_groups"
    ? "Contanos cuántos grupos organizás y qué necesitás. Revisamos tu solicitud antes de habilitar otro grupo."
    : intent === "setup_help" ? "Contanos dónde tenés los jugadores o el historial y qué te gustaría cargar. Evaluamos el alcance con vos antes de hacer cambios."
    : "Escribinos si necesitás ayuda, encontraste un error o tenés una sugerencia.";
  return <div className="mx-auto max-w-3xl space-y-4">
    <Card><CardTitle className="text-3xl">{title}</CardTitle><CardDescription className="mt-3">{description}</CardDescription>
      <a className="mt-4 inline-block text-sm font-semibold text-emerald-300 underline" href="mailto:info@fabricadefutbol.com.ar">info@fabricadefutbol.com.ar</a>
    </Card>
    {params.sent ? <Card><p role="status" className="text-emerald-300">Recibimos tu mensaje. Gracias por escribirnos.</p></Card> : null}
    {params.error ? <Card><p role="alert" className="text-danger">{params.error}</p></Card> : null}
    <Card><form action={submitFeedbackAction.bind(null, params.org ?? null, "organizations", intent)} className="space-y-4">
      <input autoComplete="off" className="hidden" name="website" tabIndex={-1} type="text" />
      <input name="module" type="hidden" value="organizations" />
      <div className="grid gap-4 sm:grid-cols-2"><div><label className="mb-1 block text-sm font-semibold" htmlFor="fullName">Nombre</label><Input autoComplete="name" id="fullName" maxLength={80} name="fullName" required /></div>
        <div><label className="mb-1 block text-sm font-semibold" htmlFor="email">Email</label><Input autoComplete="email" id="email" name="email" required type="email" /></div></div>
      <div><label className="mb-1 block text-sm font-semibold" htmlFor="category">Motivo</label><Select defaultValue={intent ?? "sugerencia"} id="category" name="category">
        <option value="multiple_groups">Administrar varios grupos</option><option value="setup_help">Ayuda para la carga inicial</option>
        <option value="sugerencia">Sugerencia</option><option value="queja">Queja</option><option value="error">Reporte de error</option><option value="otro">Otra consulta</option>
      </Select></div>
      <div><label className="mb-1 block text-sm font-semibold" htmlFor="organization">Grupo (opcional)</label><Input defaultValue={params.org ?? ""} id="organization" maxLength={80} name="organization" /></div>
      <div><label className="mb-1 block text-sm font-semibold" htmlFor="message">Mensaje</label><Textarea id="message" maxLength={2500} minLength={10} name="message" placeholder={intent === "multiple_groups" ? "Cuántos grupos son, cuántas veces juegan y qué necesitás organizar…" : intent === "setup_help" ? "Cantidad aproximada de jugadores y partidos, formato actual y ayuda que necesitás…" : "Contanos en qué podemos ayudarte…"} required rows={7} /></div>
      <p className="text-xs text-slate-400">No adjuntes contraseñas ni datos sensibles. La solicitud no genera cobros ni habilita grupos automáticamente.</p>
      <Button type="submit">Enviar mensaje</Button>
    </form></Card>
    <Link className="inline-block text-sm text-emerald-300 underline" href="/help">Consultar ayuda</Link>
  </div>;
}
