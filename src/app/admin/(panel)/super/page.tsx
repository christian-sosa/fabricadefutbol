import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import { requireAdminSession } from "@/lib/auth/admin";
import { getSuperAdminDashboardMetrics } from "@/lib/queries/admin";
import { withOrgQuery } from "@/lib/org";

function metricNumber(value: number) {
  return new Intl.NumberFormat("es-AR").format(value);
}

const AUDIT_EVENT_LABELS: Record<string, string> = {
  "organization.created": "Grupo creado",
  "organization.admin_invite.created": "Invitacion enviada",
  "organization.admin_invite.accepted": "Invitacion aceptada",
  "organization.admin_invite.revoked": "Invitacion cancelada",
  "organization.admin.removed": "Admin removido"
};

export default async function SuperAdminDashboardPage() {
  const admin = await requireAdminSession();
  if (!admin.isSuperAdmin) {
    redirect("/admin?error=Solo%20el%20super%20admin%20puede%20ver%20este%20panel.");
  }

  const metrics = await getSuperAdminDashboardMetrics();

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-emerald-400/20 bg-gradient-to-br from-emerald-500/10 to-slate-900 p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">Vista global</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-white">Panel de super admin</h1>
        <CardDescription className="mt-1">
          La actividad de Fábrica de Fútbol, en un solo lugar. Actualizado: {formatDateTime(metrics.generatedAt)}.
        </CardDescription>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground" href="/admin?view=groups">
            Administrar grupos
          </Link>
          <a className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800" href="#grupos-con-actividad">Ver grupos con más jugadores</a>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
            href="/api/admin/super-metrics/export"
          >
            Exportar métricas (CSV)
          </Link>
        </div>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardDescription>Grupos</CardDescription>
          <CardTitle className="mt-1 text-3xl">{metricNumber(metrics.totals.organizations)}</CardTitle>
          <p className="mt-2 text-xs text-slate-400">Sin jugadores: {metricNumber(metrics.derived.organizationsWithoutPlayers)}</p>
        </Card>
        <Card>
          <CardDescription>Jugadores</CardDescription>
          <CardTitle className="mt-1 text-3xl">{metricNumber(metrics.totals.players)}</CardTitle>
          <p className="mt-2 text-xs text-slate-400">
            Activos {metricNumber(metrics.totals.activePlayers)} / Inactivos {metricNumber(metrics.totals.inactivePlayers)}
          </p>
        </Card>
        <Card>
          <CardDescription>Partidos</CardDescription>
          <CardTitle className="mt-1 text-3xl">{metricNumber(metrics.totals.matches)}</CardTitle>
          <p className="mt-2 text-xs text-slate-400">
            Finalizados {metricNumber(metrics.totals.finishedMatches)} ({metrics.derived.completionRatePercent.toFixed(1)}%)
          </p>
        </Card>
        <Card>
          <CardDescription>Admins</CardDescription>
          <CardTitle className="mt-1 text-3xl">{metricNumber(metrics.totals.admins)}</CardTitle>
          <p className="mt-2 text-xs text-slate-400">
            Invitaciones pendientes: {metricNumber(metrics.totals.pendingInvites)}
          </p>
        </Card>
      </section>

      <Card>
        <CardTitle>Activación y hábito de los grupos</CardTitle>
        <CardDescription className="mt-2">Calculado desde partidos finalizados. Los porcentajes excluyen grupos que todavía no tuvieron tiempo de completar la ventana.</CardDescription>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div><p className="text-sm text-slate-400">Primer resultado en 7 días</p><p className="mt-1 text-2xl font-bold">{metrics.activation.activation7dPercent === null ? "—" : `${metrics.activation.activation7dPercent}%`}</p><p className="text-xs text-slate-400">{metrics.activation.activatedWithin7d} de {metrics.activation.eligibleForActivation7d} grupos con al menos 7 días</p></div>
          <div><p className="text-sm text-slate-400">Segundo resultado en 14 días</p><p className="mt-1 text-2xl font-bold">{metrics.activation.repeat14dPercent === null ? "—" : `${metrics.activation.repeat14dPercent}%`}</p><p className="text-xs text-slate-400">{metrics.activation.repeatedWithin14d} de {metrics.activation.eligibleForRepeat14d} grupos elegibles desde su primer resultado</p></div>
          <div><p className="text-sm text-slate-400">Volvieron a cargar un resultado</p><p className="mt-1 text-2xl font-bold">{metrics.activation.weeklyReturnPercent === null ? "—" : `${metrics.activation.weeklyReturnPercent}%`}</p><p className="text-xs text-slate-400">{metrics.activation.returnedGroups7d} de {metrics.activation.activeGroupsPrevious7d} grupos activos en los 7 días anteriores</p></div>
          <div><p className="text-sm text-slate-400">Tiempo al primer resultado (mediana)</p><p className="mt-1 text-2xl font-bold">{metrics.activation.medianHoursToFirstResult === null ? "—" : `${metrics.activation.medianHoursToFirstResult} h`}</p></div>
          <div><p className="text-sm text-slate-400">Grupos con resultados esta semana</p><p className="mt-1 text-2xl font-bold">{metrics.activation.activeGroupsLast7d}</p></div>
          <div><p className="text-sm text-slate-400">Alcanzaron uno / dos resultados</p><p className="mt-1 text-2xl font-bold">{metrics.activation.groupsWithFirstResult} / {metrics.activation.groupsWithSecondResult}</p></div>
        </div>
        <p className="mt-4 text-xs text-slate-400">Retorno: últimos 7 días frente a los 7 días inmediatamente anteriores, como ventanas móviles. Se cuenta actividad de carga de resultados; cargar historial antiguo no demuestra que se haya jugado esa semana. Un guion indica que no hay grupos elegibles.</p>
      </Card>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Metricas clave</CardTitle>
          <div className="mt-3 space-y-2 text-sm text-slate-200">
            <p>Admins registrados: {metricNumber(metrics.totals.admins)}</p>
            <p>Asignaciones admin-org: {metricNumber(metrics.totals.orgAdminMemberships)}</p>
            <p>Invitaciones pendientes: {metricNumber(metrics.totals.pendingInvites)}</p>
            <p>Promedio de jugadores por grupo: {metrics.derived.avgPlayersPerOrganization.toFixed(2)}</p>
            <p>Promedio de partidos por grupo: {metrics.derived.avgMatchesPerOrganization.toFixed(2)}</p>
            <p>Resultados cargados: {metricNumber(metrics.totals.matchResults)}</p>
            <p>Invitados en partidos: {metricNumber(metrics.totals.matchGuests)}</p>
          </div>
        </Card>

        <Card>
          <CardTitle>Actividad ultimos 30 dias</CardTitle>
          <div className="mt-3 space-y-2 text-sm text-slate-200">
            <p>Grupos creados: {metricNumber(metrics.last30Days.organizationsCreated)}</p>
            <p>Jugadores creados: {metricNumber(metrics.last30Days.playersCreated)}</p>
            <p>Partidos creados: {metricNumber(metrics.last30Days.matchesCreated)}</p>
            <p>Partidos finalizados: {metricNumber(metrics.last30Days.matchesFinished)}</p>
          </div>
        </Card>
      </section>

      <Card>
        <CardTitle>WhatsApp → nuevos organizadores · últimos 30 días</CardTitle>
        {metrics.referrals ? <>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div><p className="text-sm text-slate-400">Sesiones referidas observadas</p><p className="mt-1 text-2xl font-bold">{metrics.referrals.referredSessions}</p></div>
            <div><p className="text-sm text-slate-400">Registros con email atribuidos</p><p className="mt-1 text-2xl font-bold">{metrics.referrals.referredRegistrations}</p></div>
            <div><p className="text-sm text-slate-400">Grupos creados atribuidos</p><p className="mt-1 text-2xl font-bold">{metrics.referrals.referredGroups}</p></div>
          </div><p className="mt-4 text-xs text-slate-400">Última visita identificada con parámetros de WhatsApp, durante 30 días y en el mismo navegador. Una sesión no equivale a una persona. Los clics de compartir no prueban que el mensaje se haya enviado. Bloqueadores y cookies borradas reducen la medición; el alta de grupo también permite seguir usuarios que ingresan con Google.</p>
        </> : <CardDescription className="mt-2">La medición de referencias no está disponible. Los datos de actividad de grupos siguen calculándose desde partidos.</CardDescription>}
      </Card>

      <Card className="scroll-mt-6 rounded-2xl p-5 sm:p-6" id="grupos-con-actividad">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><CardTitle>Grupos con más jugadores</CardTitle>
            <CardDescription className="mt-1">Una vista por grupo para encontrar dónde hay más actividad.</CardDescription>
          </div>
          <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-emerald-300 hover:underline" href="/admin?view=groups">Buscar entre todos los grupos →</Link>
        </div>
        <ul className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {metrics.topOrganizations.map((organization, index) => (
            <li className="min-w-0 rounded-2xl border border-slate-700/80 bg-slate-950/50 p-5" key={organization.id}>
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-sm font-bold text-slate-400">{index + 1}</span>
                <div className="min-w-0"><h3 className="break-words font-bold text-white">{organization.name}</h3><p className="mt-1 break-all text-xs text-slate-500">{organization.slug}</p></div>
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-4">
                <div><dt className="text-xs text-slate-400">Jugadores</dt><dd className="mt-1 text-2xl font-bold text-white">{metricNumber(organization.players)}</dd><dd className="text-xs text-slate-500">{metricNumber(organization.activePlayers)} activos</dd></div>
                <div><dt className="text-xs text-slate-400">Partidos</dt><dd className="mt-1 text-2xl font-bold text-white">{metricNumber(organization.matches)}</dd><dd className="text-xs text-slate-500">{metricNumber(organization.finishedMatches)} finalizados</dd></div>
              </dl>
              <p className="mt-4 border-t border-slate-800 pt-3 text-xs text-slate-400">{metricNumber(organization.admins)} admins · {metricNumber(organization.pendingInvites)} invitaciones pendientes</p>
              <Link aria-label={`Administrar ${organization.name}`} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-emerald-300 hover:underline" href={withOrgQuery("/admin", organization.slug)}>Administrar grupo →</Link>
            </li>
          ))}
        </ul>
        {!metrics.topOrganizations.length ? <p className="mt-4 text-sm text-slate-400">No hay grupos cargados.</p> : null}
      </Card>

      <Card>
        <CardTitle>Auditoria reciente</CardTitle>
        <CardDescription className="mt-1">
          Ultimos eventos sensibles de grupos: altas, invitaciones, aceptaciones, cancelaciones y remociones.
        </CardDescription>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-100">
            <thead className="bg-slate-800/80 text-slate-300">
              <tr>
                <th className="px-4 py-3 font-semibold">Fecha</th>
                <th className="px-4 py-3 font-semibold">Evento</th>
                <th className="px-4 py-3 font-semibold">Grupo</th>
                <th className="px-4 py-3 font-semibold">Actor</th>
                <th className="px-4 py-3 font-semibold">Destino</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {metrics.recentAuditEvents.map((event) => (
                <tr key={event.id}>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(event.createdAt)}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{AUDIT_EVENT_LABELS[event.eventType] ?? event.eventType}</p>
                    <p className="text-xs text-slate-400">{event.eventType}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{event.organizationName}</p>
                    <p className="text-xs text-slate-400">{event.organizationSlug}</p>
                  </td>
                  <td className="px-4 py-3">{event.actorEmail ?? event.actorAdminId ?? "-"}</td>
                  <td className="px-4 py-3">{event.targetEmail ?? event.targetAdminId ?? "-"}</td>
                </tr>
              ))}
              {!metrics.recentAuditEvents.length ? (
                <tr>
                  <td className="px-4 py-4 text-slate-400" colSpan={5}>
                    No hay eventos de auditoria registrados todavia.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardTitle>Que te estoy mostrando y como se calcula</CardTitle>
        <div className="mt-3 space-y-2 text-sm text-slate-300">
          <p>
            1. Totales globales: conteos directos de tablas principales (grupos, jugadores, partidos, admins,
            resultados e invitados).
          </p>
          <p>
            2. Metricas derivadas: promedios por grupo y porcentaje de finalizacion, calculados sobre los datos
            actuales del sistema.
          </p>
          <p>
            3. Actividad 30 dias: compara fechas de creacion/finalizacion contra una ventana movil de 30 dias para
            medir ritmo de crecimiento.
          </p>
          <p>
            4. Export CSV: descarga snapshot con timestamp, metricas globales y detalle por grupo para analisis
            en BI/Excel.
          </p>
        </div>
      </Card>
    </div>
  );
}
