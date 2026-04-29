import Link from "next/link";

import { submitFeedbackAction } from "@/app/feedback/actions";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { isTournamentsEnabled } from "@/lib/features";
import { resolvePublicModule, withPublicQuery } from "@/lib/org";

type FeedbackPageProps = {
  searchParams: Promise<{
    org?: string;
    module?: string;
    sent?: string;
    error?: string;
  }>;
};

export default async function FeedbackPage({ searchParams }: FeedbackPageProps) {
  const resolvedSearchParams = await searchParams;
  const organizationKey = resolvedSearchParams.org ?? null;
  const currentModule = resolvePublicModule(resolvedSearchParams.module);
  const tournamentsEnabled = isTournamentsEnabled();
  const submitAction = submitFeedbackAction.bind(null, organizationKey, currentModule);
  const homePath = withPublicQuery("/", {
    organizationKey,
    module: currentModule
  });
  const helpPath = withPublicQuery("/help", {
    organizationKey,
    module: currentModule
  });
  const moduleDescription =
    tournamentsEnabled && currentModule === "tournaments"
      ? "Si tu consulta es por torneos, capitanes, fixture o resultados, la dejamos lista para soporte."
      : "Si tu consulta es por grupos, ranking o partidos equilibrados, la recibimos por aqui.";
  const targetPlaceholder =
    tournamentsEnabled && currentModule === "tournaments" ? "Ej: Copa Apertura 2026" : "Ej: La Cantera de LQ";

  return (
    <div className="space-y-4">
      <Card className="rounded-[2rem] p-5 md:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">Contacto</p>
        <CardTitle className="mt-2 text-3xl">Necesitas ayuda?</CardTitle>
        <CardDescription className="mt-3 text-base">
          Estamos para ayudarte a configurar tu grupo, resolver dudas y ordenar tu flujo sin romper nada.
        </CardDescription>
        <p className="mt-3 text-sm text-slate-300">{moduleDescription}</p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Mail</p>
            <a
              className="mt-2 block text-sm font-semibold text-emerald-300 transition hover:underline"
              href="mailto:info@fabricadefutbol.com.ar"
            >
              info@fabricadefutbol.com.ar
            </a>
            <p className="mt-2 text-sm text-slate-400">Canal principal de soporte y consultas comerciales.</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Sugerencias</p>
            <p className="mt-2 text-sm text-slate-300">
              Si tienes una idea para mejorar Fabrica de Futbol, tambien puedes escribirnos. Las sugerencias son bienvenidas.
            </p>
          </div>
        </div>
      </Card>

      {resolvedSearchParams.sent ? (
        <Card className="border-emerald-500/40 bg-emerald-500/10">
          <CardTitle>Mensaje enviado</CardTitle>
          <CardDescription className="mt-1">
            Gracias por escribirnos. Recibimos tu mensaje correctamente.
          </CardDescription>
        </Card>
      ) : null}

      {resolvedSearchParams.error ? (
        <Card className="border-danger/40 bg-danger/10">
          <CardTitle>No se pudo enviar</CardTitle>
          <CardDescription className="mt-1">{resolvedSearchParams.error}</CardDescription>
        </Card>
      ) : null}

      <Card>
        <CardTitle>Formulario</CardTitle>
        <form action={submitAction} className="mt-4 space-y-3">
          <input autoComplete="off" className="hidden" name="website" tabIndex={-1} type="text" />

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="fullName">
                Nombre
              </label>
              <Input id="fullName" name="fullName" placeholder="Tu nombre" required />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="email">
                Email
              </label>
              <Input id="email" name="email" placeholder="tu@email.com" required type="email" />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="category">
                Tipo
              </label>
              <Select defaultValue="sugerencia" id="category" name="category">
                <option value="sugerencia">Sugerencia</option>
                <option value="queja">Queja</option>
                <option value="error">Reporte de error</option>
                <option value="otro">Otro</option>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="module">
                Tema
              </label>
              <Select defaultValue={currentModule} id="module" name="module">
                <option value="organizations">Grupos</option>
                {tournamentsEnabled ? <option value="tournaments">Torneos</option> : null}
                <option value="both">General</option>
              </Select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="organization">
              {tournamentsEnabled ? "Grupo o torneo (opcional)" : "Grupo (opcional)"}
            </label>
            <Input id="organization" name="organization" placeholder={targetPlaceholder} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="message">
              Mensaje
            </label>
            <Textarea
              id="message"
              maxLength={2500}
              minLength={10}
              name="message"
              placeholder="Cuentanos que paso o que te gustaria mejorar."
              required
              rows={7}
            />
            <p className="mt-1 text-xs text-slate-500">Minimo 10 caracteres.</p>
          </div>

          <Button type="submit">Enviar mensaje</Button>
        </form>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          className="rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
          href={homePath}
        >
          Volver al inicio
        </Link>
        <Link
          className="rounded-md border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
          href={helpPath}
        >
          Ir a ayuda
        </Link>
      </div>
    </div>
  );
}
