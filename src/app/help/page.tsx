import Link from "next/link";

import { AdPlaceholder } from "@/components/layout/ad-placeholder";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ORGANIZATION_BILLING_CURRENCY, ORGANIZATION_MONTHLY_PRICE_ARS } from "@/lib/constants";

function formatCurrencyArs(amount: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: ORGANIZATION_BILLING_CURRENCY,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

const faqItems = [
  {
    question: "Que es Fabrica de Futbol?",
    answer:
      "Es una app para administrar organizaciones de futbol amateur. Cada organizacion puede cargar jugadores, armar partidos, confirmar equipos y publicar resultados."
  },
  {
    question: "Necesito estar logeado para ver datos?",
    answer:
      "No. Las organizaciones son publicas, por eso cualquier persona puede consultar ranking, jugadores, historial y proximos partidos."
  },
  {
    question: "Que puedo hacer cuando me registro?",
    answer:
      "Podes crear organizaciones y administrarlas. Tambien podes aceptar invitaciones para ser admin en organizaciones creadas por otras personas."
  },
  {
    question: "Cuantos admins puede tener una organizacion?",
    answer:
      "Cada organizacion admite hasta 4 administradores activos o pendientes de invitacion (por ejemplo 1 creador + 3 invitados)."
  },
  {
    question: "La app tiene costo?",
    answer:
      `Cada organizacion tiene 1 mes de uso gratis desde su creacion. Al terminar ese periodo, el costo es ${formatCurrencyArs(ORGANIZATION_MONTHLY_PRICE_ARS)} por mes por organizacion para mantener escritura habilitada.`
  },
  {
    question: "Que pasa cuando termina el mes free?",
    answer:
      "La organizacion queda en modo solo lectura: se conserva toda la informacion publica, pero no se pueden crear partidos ni editar, agregar o borrar jugadores."
  },
  {
    question: "Puedo crear varias organizaciones gratis con el mismo email?",
    answer:
      `No. Cada cuenta tiene una sola organizacion gratis inicial. Si ya consumiste esa prueba, para crear nuevas organizaciones debes pagar ${formatCurrencyArs(ORGANIZATION_MONTHLY_PRICE_ARS)} por cada nueva alta.`
  },
  {
    question: "Donde veo el detalle de precios y condiciones?",
    answer:
      "En la seccion Precios (/pricing) tienes el resumen del plan, periodo gratis, costo mensual y que sucede cuando una organizacion pasa a modo solo lectura."
  },
  {
    question: "Donde envio sugerencias o reclamos?",
    answer:
      "En la seccion Contacto (/feedback) puedes enviar sugerencias, quejas o reportes de error y llega al equipo por email."
  }
];

export default function HelpPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-800 bg-slate-900/75 p-5 shadow-[0_24px_40px_-30px_rgba(16,185,129,0.7)] md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">Guia del proyecto</p>
        <h1 className="mt-2 text-3xl font-black text-slate-100 md:text-5xl">Ayuda y preguntas frecuentes</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-300 md:text-base">
          Todo lo importante para entender como funciona la app y arrancar rapido.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_-14px_rgba(16,185,129,1)]"
            href="/"
          >
            Volver al inicio
          </Link>
          <Link
            className="rounded-md border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
            href="/pricing"
          >
            Ver precios
          </Link>
          <Link
            className="rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
            href="/admin/login"
          >
            Ingresar / Registro
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Como empezar</CardTitle>
          <CardDescription className="mt-2">
            1. Entra al panel y registrate.
            <br />
            2. Crea una organizacion.
            <br />
            3. Carga jugadores y arma partidos.
            <br />
            4. Invita admins para ayudarte a gestionar.
          </CardDescription>
        </Card>
        <Card>
          <CardTitle>Flujo recomendado</CardTitle>
          <CardDescription className="mt-2">
            Primero crea la base de jugadores, despues confirma partidos, y al final registra resultado y estadisticas para
            mantener el ranking ordenado.
          </CardDescription>
        </Card>
      </section>

      <AdPlaceholder slot="help-top-banner" />

      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">FAQ</p>
        <div className="space-y-3">
          {faqItems.map((item) => (
            <Card key={item.question}>
              <CardTitle>{item.question}</CardTitle>
              <CardDescription className="mt-2">{item.answer}</CardDescription>
            </Card>
          ))}
        </div>
      </section>

      <AdPlaceholder slot="help-bottom-banner" />
    </div>
  );
}
