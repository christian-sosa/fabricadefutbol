import Link from "next/link";

import { archiveTournamentAction, createTournamentAction } from "@/app/admin/(panel)/tournaments/actions";
import { TournamentStatusBadge } from "@/components/tournaments/tournament-badges";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getAdminTournaments } from "@/lib/auth/tournaments";
import { requireAdminSession } from "@/lib/auth/admin";

export default async function AdminTournamentsPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const admin = await requireAdminSession();
  const tournaments = await getAdminTournaments(admin);
  const resolvedSearchParams = await searchParams;

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Torneos</CardTitle>
        <CardDescription>
          Crea y administra ligas o torneos independientes del flujo actual de organizaciones.
        </CardDescription>
        {resolvedSearchParams.error ? <p className="mt-3 text-sm font-semibold text-danger">{resolvedSearchParams.error}</p> : null}
        {resolvedSearchParams.success ? (
          <p className="mt-3 text-sm font-semibold text-emerald-300">{resolvedSearchParams.success}</p>
        ) : null}
      </Card>

      <Card>
        <CardTitle>Nuevo torneo</CardTitle>
        <form action={createTournamentAction} className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="name">
              Nombre
            </label>
            <Input id="name" name="name" placeholder="Liga del Sabado" required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="seasonLabel">
              Temporada / edicion
            </label>
            <Input defaultValue="2026" id="seasonLabel" name="seasonLabel" placeholder="Apertura 2026" required />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="description">
              Descripcion
            </label>
            <Textarea id="description" name="description" placeholder="Descripcion opcional del torneo" rows={3} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-200 md:col-span-2">
            <input className="h-4 w-4 accent-emerald-400" defaultChecked name="isPublic" type="checkbox" />
            Publicar este torneo en las paginas publicas
          </label>
          <div className="md:col-span-2">
            <Button type="submit">Crear torneo</Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardTitle>Mis torneos</CardTitle>
        <CardDescription>Entra a cada torneo para cargar equipos, planteles, fixture y resultados.</CardDescription>

        <div className="mt-4 space-y-3">
          {tournaments.length ? (
            tournaments.map((tournament) => (
              <div
                className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 md:flex-row md:items-center md:justify-between"
                key={tournament.id}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold text-slate-100">{tournament.name}</p>
                    <TournamentStatusBadge status={tournament.status} />
                    <span className="rounded-full border border-slate-700 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">
                      {tournament.season_label}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-400">/{tournament.slug}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {tournament.is_public ? "Visible publicamente" : "Solo admin"}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    className="text-sm font-semibold text-emerald-300 hover:underline"
                    href={`/admin/tournaments/${tournament.id}`}
                  >
                    Gestionar
                  </Link>
                  <Link
                    className="text-sm font-semibold text-sky-300 hover:underline"
                    href={`/tournaments/${tournament.slug}`}
                  >
                    Ver publico
                  </Link>
                  {tournament.status !== "archived" ? (
                    <form action={archiveTournamentAction}>
                      <input name="tournamentId" type="hidden" value={tournament.id} />
                      <Button type="submit" variant="ghost">
                        Archivar
                      </Button>
                    </form>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-400">Todavia no administras ningun torneo.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
