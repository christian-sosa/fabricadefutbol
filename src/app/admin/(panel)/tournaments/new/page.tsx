import Link from "next/link";

import { createLeagueAction } from "@/app/admin/(panel)/tournaments/actions";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TEMP_SKIP_TOURNAMENT_CHECKOUT } from "@/lib/constants";

export default function NewTournamentLeaguePage() {
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Nueva liga</CardTitle>
            <CardDescription className="mt-2">
              Crea una liga nueva solo cuando necesites separar equipos, competencias y administradores.
            </CardDescription>
          </div>
          <Link
            className="inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:border-emerald-400/60 hover:text-emerald-300"
            href="/admin/tournaments"
          >
            Volver
          </Link>
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <CardTitle>Datos de la liga</CardTitle>
        <CardDescription className="mt-2">
          {TEMP_SKIP_TOURNAMENT_CHECKOUT
            ? "Carga el nombre de la liga y la creamos al instante. Luego podras cargar equipos, competencias y capitanes opcionales."
            : "Carga el nombre de la liga y te llevamos a Mercado Pago para confirmar el alta antes de habilitar equipos y competencias."}
        </CardDescription>
        <form action={createLeagueAction} className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="name">
              Nombre de la liga
            </label>
            <Input id="name" name="name" placeholder="Ej: LAFAB" required />
          </div>
          <div className="md:self-end">
            <Button type="submit">{TEMP_SKIP_TOURNAMENT_CHECKOUT ? "Crear liga" : "Continuar a Mercado Pago"}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
