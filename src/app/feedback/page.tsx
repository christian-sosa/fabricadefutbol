import Link from "next/link";

import { submitFeedbackAction } from "@/app/feedback/actions";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { withOrgQuery } from "@/lib/org";

type FeedbackPageProps = {
  searchParams: Promise<{
    org?: string;
    sent?: string;
    error?: string;
  }>;
};

export default async function FeedbackPage({ searchParams }: FeedbackPageProps) {
  const resolvedSearchParams = await searchParams;
  const organizationKey = resolvedSearchParams.org ?? null;
  const submitAction = submitFeedbackAction.bind(null, organizationKey);
  const homePath = withOrgQuery("/", organizationKey);
  const helpPath = withOrgQuery("/help", organizationKey);

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Sugerencias, quejas y contacto</CardTitle>
        <CardDescription className="mt-2">
          Envia comentarios para mejorar Fabrica de Futbol. Te responderemos por email si dejas un
          contacto valido.
        </CardDescription>
        <p className="mt-2 text-xs text-slate-400">
          Tambien puedes escribir directo a <span className="font-semibold text-slate-200">info@fabricadefutbol.com.ar</span>.
        </p>
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
              <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="organization">
                Organizacion (opcional)
              </label>
              <Input id="organization" name="organization" placeholder="Ej: F5 Lunes" />
            </div>
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
