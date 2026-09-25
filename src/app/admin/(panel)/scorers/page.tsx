import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminCurrentGroupCard } from "@/components/admin/admin-current-group-card";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { requireAdminOrganization } from "@/lib/auth/admin";
import { withOrgQuery } from "@/lib/org";
import { getAdminHistoricalScorers } from "@/lib/queries/admin-match-extras";

const number = new Intl.NumberFormat("es-AR");

export default async function AdminScorersPage({ searchParams }: { searchParams: Promise<{ org?: string; page?: string }> }) {
  const params = await searchParams;
  const { admin, selectedOrganization } = await requireAdminOrganization(params.org);
  const page = /^\d{1,6}$/.test(params.page ?? "") ? Math.max(1, Number(params.page)) : 1;
  const history = await getAdminHistoricalScorers(selectedOrganization.id, page);
  if (page !== history.page) {
    redirect(withOrgQuery(`/admin/scorers?page=${history.page}`, selectedOrganization.slug));
  }

  return (
    <div className="space-y-5">
      <AdminCurrentGroupCard admin={admin} organization={selectedOrganization} />
      <Card className="rounded-2xl p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="uppercase tracking-widest text-emerald-300">Registro privado</span>
          <span className="rounded-full border border-slate-700 px-2.5 py-1 text-slate-300">Todas las temporadas</span>
        </div>
        <h1 className="mt-3 text-2xl font-black text-white sm:text-3xl">Goleadores históricos</h1>
        <CardDescription className="mt-2 max-w-2xl">Los goles de tu grupo, acumulados a lo largo del tiempo. Incluye los autores registrados en partidos finalizados de F9, F10 y F11.</CardDescription>
        <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-slate-800 pt-5 sm:gap-6">
          {[
            { label: "Goles registrados", value: history.totalGoals },
            { label: "Goleadores del grupo", value: history.totalScorers },
            { label: "Partidos computados", value: history.matchesRecorded }
          ].map(({ label, value }) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs leading-relaxed text-slate-400">{label}</dt>
              <dd className="mt-1 text-2xl font-black tabular-nums text-slate-100 sm:text-3xl">{number.format(value)}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card className="rounded-2xl p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Ranking histórico</CardTitle>
            <CardDescription className="mt-1">Jugadores del grupo, ordenados por total de goles.</CardDescription>
          </div>
          <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-emerald-300 hover:underline" href={withOrgQuery("/admin/matches", selectedOrganization.slug)}>Ir a partidos →</Link>
        </div>

        {history.scorers.length ? (
          <table className="mt-5 w-full table-fixed text-left text-sm">
            <caption className="sr-only">Goleadores históricos del grupo</caption>
            <thead className="border-b border-slate-700 text-xs text-slate-400">
              <tr>
                <th scope="col" className="w-12 pb-3 font-medium">Puesto</th>
                <th scope="col" className="px-2 pb-3 font-medium">Jugador</th>
                <th scope="col" className="w-20 pb-3 text-right font-medium">Goles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {history.scorers.map((scorer) => (
                <tr key={scorer.playerId}>
                  <td className="py-4 align-top"><span className={`inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg px-1 font-bold tabular-nums ${scorer.rank === 1 ? "bg-emerald-400/15 text-emerald-200" : "text-slate-400"}`}>{number.format(scorer.rank)}</span></td>
                  <th scope="row" className="break-words px-2 py-4 font-semibold text-slate-100">
                    {scorer.displayName}{" "}
                    <span className="mt-1 block text-xs font-normal text-slate-400">{number.format(scorer.matchesPlayed)} {scorer.matchesPlayed === 1 ? "partido computado" : "partidos computados"}</span>
                  </th>
                  <td className="py-4 text-right align-top text-xl font-black tabular-nums text-emerald-300">{number.format(scorer.goals)}{" "}<span className="sr-only">{scorer.goals === 1 ? "gol" : "goles"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="mt-5 rounded-xl border border-dashed border-slate-700 p-5">
            <p className="font-semibold text-slate-200">{history.guestGoals ? "Todavía no hay goles registrados de jugadores del grupo" : "Todavía no hay goles registrados"}</p>
            <p className="mt-2 text-sm text-slate-400">Cargá los autores al guardar o corregir el resultado de un partido. Sus goles se irán acumulando acá.</p>
          </div>
        )}

        {history.pageCount > 1 ? (
          <nav aria-label="Páginas del ranking histórico de goleadores" className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4 text-sm">
            {page > 1 ? <Link className="min-h-11 rounded-lg border border-slate-700 px-4 py-3" href={withOrgQuery(`/admin/scorers?page=${page - 1}`, selectedOrganization.slug)}>Anterior</Link> : <span />}
            <span className="text-slate-400">Página {page} de {history.pageCount}</span>
            {page < history.pageCount ? <Link className="min-h-11 rounded-lg border border-slate-700 px-4 py-3" href={withOrgQuery(`/admin/scorers?page=${page + 1}`, selectedOrganization.slug)}>Siguiente</Link> : <span />}
          </nav>
        ) : null}
      </Card>

      <div className="space-y-2 px-1 text-xs leading-relaxed text-slate-400">
        <p>Para cada jugador se cuentan los partidos en los que jugó y se cargó al menos un goleador, aunque él no haya marcado. Los empates 0–0 también cuentan. Los demás resultados sin goleadores cargados quedan fuera del conteo.</p>
        {history.guestGoals > 0 ? <p>El total incluye {number.format(history.guestGoals)} {history.guestGoals === 1 ? "gol de invitados" : "goles de invitados"}. Podés consultar sus autores en las actas de los partidos.</p> : null}
        <p>Sólo los administradores del grupo pueden ver este registro. Se cuentan únicamente los goles con autor cargado. No modifican los puntos ni se publican en el ranking del grupo.</p>
      </div>
    </div>
  );
}
