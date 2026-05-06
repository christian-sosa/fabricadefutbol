import Link from "next/link";

import { createLeagueAction } from "@/app/admin/(panel)/tournaments/actions";
import { adminContextActionLinkClass } from "@/components/admin/admin-context-actions";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requireAdminSession } from "@/lib/auth/admin";
import { getLeagueCreationAccess } from "@/lib/auth/tournaments";
import { TEMP_SKIP_TOURNAMENT_CHECKOUT } from "@/lib/constants";

export default async function NewTournamentLeaguePage() {
  const admin = await requireAdminSession();
  const creationAccess = await getLeagueCreationAccess(admin);

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
            className={adminContextActionLinkClass}
            href="/admin"
          >
            Volver
          </Link>
        </div>
      </Card>

      {creationAccess.canCreateLeague ? (
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
      ) : (
        <Card className="p-5 sm:p-6">
          <CardTitle>Torneos en prueba controlada</CardTitle>
          <CardDescription className="mt-2">
            {creationAccess.reason ?? "Por ahora las altas de ligas estan habilitadas manualmente."}
          </CardDescription>
        </Card>
      )}
    </div>
  );
}
