import Link from "next/link";
import { FeedbackForm } from "./feedback-form";
import { Card, CardDescription } from "@/components/ui/card";
import { buildPublicMetadata } from "@/lib/seo";

export const metadata = buildPublicMetadata({
  title: "Contacto y ayuda para tu grupo",
  description:
    "Escribinos para recibir ayuda con tu grupo de fútbol, solicitar asistencia para cargar jugadores e historial o consultar por la gestión de varios grupos.",
  path: "/feedback"
});

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<{ org?: string; intent?: string; sent?: string; error?: string }> }) {
  const params = await searchParams;
  const intent = params.intent === "multiple_groups" || params.intent === "setup_help" ? params.intent : null;
  const title = intent === "multiple_groups" ? "Necesito administrar varios grupos" : intent === "setup_help" ? "Ayuda para la carga inicial" : "Contacto";
  const description = intent === "multiple_groups"
    ? "Contanos cuántos grupos organizás y qué necesitás. Revisamos tu solicitud antes de habilitar otro grupo."
    : intent === "setup_help" ? "Podemos ayudarte a preparar una lista de jugadores, ajustar niveles y cargar el historial que acuerdes con nosotros. Contanos cantidades y formato; revisamos el alcance y cualquier presupuesto antes de recibir archivos o hacer cambios. Grupos sigue siendo gratis."
    : "Escribinos si necesitás ayuda, encontraste un error o tenés una sugerencia.";
  return <div className="mx-auto max-w-3xl space-y-4">
    <Card><h1 className="text-3xl font-semibold text-slate-100">{title}</h1><CardDescription className="mt-3">{description}</CardDescription>
      <a className="mt-4 inline-block text-sm font-semibold text-emerald-300 underline" href="mailto:info@fabricadefutbol.com.ar">info@fabricadefutbol.com.ar</a>
    </Card>
    {params.sent ? <Card><p role="status" className="text-emerald-300">Recibimos tu mensaje. Gracias por escribirnos.</p></Card> : null}
    {params.error ? <Card><p role="alert" className="text-danger">{params.error}</p></Card> : null}
    <Card><FeedbackForm intent={intent} organization={params.org ?? ""} /></Card>
    <Link className="inline-block text-sm text-emerald-300 underline" href="/help">Consultar ayuda</Link>
  </div>;
}
