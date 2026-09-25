import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminCurrentGroupCard } from "@/components/admin/admin-current-group-card";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { requireAdminOrganization } from "@/lib/auth/admin";
import { formatMatchDateTime } from "@/lib/match-datetime";
import { withOrgQuery } from "@/lib/org";
import { getAdminScorerHistory } from "@/lib/queries/admin-match-extras";
import { resolveMatchTeamLabels } from "@/lib/team-labels";

export default async function AdminScorersPage({ searchParams }: { searchParams: Promise<{ org?: string; page?: string }> }) {
  const params = await searchParams;
  const { admin, selectedOrganization } = await requireAdminOrganization(params.org);
  const page = /^\d{1,6}$/.test(params.page ?? "") ? Math.max(1, Number(params.page)) : 1;
  const history = await getAdminScorerHistory(selectedOrganization.id, page);
  if (page !== history.page) {
    redirect(withOrgQuery(`/admin/scorers?page=${history.page}`, selectedOrganization.slug));
  }
  return <div className="space-y-5">
    <AdminCurrentGroupCard admin={admin} organization={selectedOrganization} />
    <Card>
      <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">Registro privado</p>
      <h1 className="mt-2 text-2xl font-black text-white">Historial de goleadores</h1>
      <CardDescription className="mt-2">Goles registrados en F9, F10 y F11. Sólo los administradores del grupo pueden verlos. No modifican los puntos ni se publican en el ranking.</CardDescription>
    </Card>
    {!history.matches.length ? <Card><CardTitle>Todavía no hay partidos en esta página</CardTitle><CardDescription className="mt-2">Los goles se anotan al cargar o corregir el resultado de un partido. El registro es opcional.</CardDescription><Link className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-emerald-300" href={withOrgQuery("/admin/matches", selectedOrganization.slug)}>Ir a partidos</Link></Card> : null}
    {history.matches.map((match) => {
      const labels = resolveMatchTeamLabels(match);
      return <Card key={match.id}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div><CardTitle>{labels.teamA} vs {labels.teamB}</CardTitle><CardDescription className="mt-1">{formatMatchDateTime(match.scheduled_at)} · {match.modality}</CardDescription></div>
          <Link className="inline-flex min-h-11 items-center rounded-lg border border-slate-700 px-3 text-sm font-semibold hover:border-emerald-400" href={withOrgQuery(`/admin/matches/${match.id}/result`, selectedOrganization.slug)}>Ver acta</Link>
        </div>
        {match.scorers.length ? <div className="mt-4 grid gap-4 sm:grid-cols-2">{(["A", "B"] as const).map((team) => <section key={team} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{team === "A" ? labels.teamA : labels.teamB}</h2>
          <ul className="mt-2 space-y-2">{match.scorers.filter((scorer) => scorer.team === team).sort((a, b) => b.goals - a.goals || a.display_name.localeCompare(b.display_name, "es")).map((scorer) => <li className="flex items-center justify-between gap-3 text-sm" key={scorer.participant_id}><span className="min-w-0 break-words">{scorer.display_name}</span><span className="shrink-0 font-bold text-emerald-300">{scorer.goals} {scorer.goals === 1 ? "gol" : "goles"}</span></li>)}</ul>
          {!match.scorers.some((scorer) => scorer.team === team) ? <p className="mt-2 text-xs text-slate-500">Sin autores registrados.</p> : null}
        </section>)}</div> : <p className="mt-4 text-sm text-slate-400">Sin goleadores registrados para este partido.</p>}
      </Card>;
    })}
    <nav aria-label="Páginas del historial de goleadores" className="flex flex-wrap items-center justify-between gap-3 text-sm">
      {page > 1 ? <Link className="min-h-11 rounded-lg border border-slate-700 px-4 py-3" href={withOrgQuery(`/admin/scorers?page=${page - 1}`, selectedOrganization.slug)}>Anterior</Link> : <span />}
      <span className="text-slate-400">Página {page} de {history.pageCount}</span>
      {page < history.pageCount ? <Link className="min-h-11 rounded-lg border border-slate-700 px-4 py-3" href={withOrgQuery(`/admin/scorers?page=${page + 1}`, selectedOrganization.slug)}>Siguiente</Link> : <span />}
    </nav>
  </div>;
}
