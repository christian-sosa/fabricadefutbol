import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import { requireAdminSession } from "@/lib/auth/admin";
import { getSuperAdminDashboardMetrics } from "@/lib/queries/admin";

function metricNumber(value: number) {
  return new Intl.NumberFormat("es-AR").format(value);
}

function formatCurrencyArs(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

function commercialStatusLabel(status: "paid_active" | "free_trial" | "expired_without_plan") {
  switch (status) {
    case "paid_active":
      return "Plan activo";
    case "free_trial":
      return "Trial gratis";
    case "expired_without_plan":
      return "Sin plan";
    default:
      return status;
  }
}

export default async function SuperAdminDashboardPage() {
  const admin = await requireAdminSession();
  if (!admin.isSuperAdmin) {
    redirect("/admin?error=Solo%20el%20super%20admin%20puede%20ver%20este%20panel.");
  }

  const metrics = await getSuperAdminDashboardMetrics();

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">Analitica global</p>
        <CardTitle className="mt-2">Dashboard de super admin</CardTitle>
        <CardDescription className="mt-1">
          Foto general del sistema en tiempo real. Ultima actualizacion: {formatDateTime(metrics.generatedAt)}.
        </CardDescription>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_-14px_rgba(16,185,129,1)]"
            href="/api/admin/super-metrics/export"
          >
            Exportar metricas (CSV)
          </Link>
        </div>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardDescription>Organizaciones</CardDescription>
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
          <CardDescription>Recaudado en {metrics.currentMonth.label}</CardDescription>
          <CardTitle className="mt-1 text-3xl">{formatCurrencyArs(metrics.currentMonth.approvedRevenueArs)}</CardTitle>
          <p className="mt-2 text-xs text-slate-400">
            Pagos aprobados {metricNumber(metrics.currentMonth.approvedPayments)} | Orgs cobradas{" "}
            {metricNumber(metrics.currentMonth.organizationsWithApprovedPayments)}
          </p>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Metricas clave</CardTitle>
          <div className="mt-3 space-y-2 text-sm text-slate-200">
            <p>Admins registrados: {metricNumber(metrics.totals.admins)}</p>
            <p>Asignaciones admin-org: {metricNumber(metrics.totals.orgAdminMemberships)}</p>
            <p>Invitaciones pendientes: {metricNumber(metrics.totals.pendingInvites)}</p>
            <p>Promedio de jugadores por organizacion: {metrics.derived.avgPlayersPerOrganization.toFixed(2)}</p>
            <p>Promedio de partidos por organizacion: {metrics.derived.avgMatchesPerOrganization.toFixed(2)}</p>
            <p>Resultados cargados: {metricNumber(metrics.totals.matchResults)}</p>
            <p>Invitados en partidos: {metricNumber(metrics.totals.matchGuests)}</p>
          </div>
        </Card>

        <Card>
          <CardTitle>Negocio y planes</CardTitle>
          <div className="mt-3 space-y-2 text-sm text-slate-200">
            <p>Organizaciones con plan activo: {metricNumber(metrics.business.activePaidOrganizations)}</p>
            <p>Organizaciones en trial gratis: {metricNumber(metrics.business.freeTrialOrganizations)}</p>
            <p>Organizaciones sin plan vigente: {metricNumber(metrics.business.expiredWithoutPlanOrganizations)}</p>
            <p>Organizaciones que alguna vez pagaron: {metricNumber(metrics.business.organizationsWithAnyApprovedPayment)}</p>
          </div>
        </Card>

        <Card>
          <CardTitle>Actividad ultimos 30 dias</CardTitle>
          <div className="mt-3 space-y-2 text-sm text-slate-200">
            <p>Organizaciones creadas: {metricNumber(metrics.last30Days.organizationsCreated)}</p>
            <p>Jugadores creados: {metricNumber(metrics.last30Days.playersCreated)}</p>
            <p>Partidos creados: {metricNumber(metrics.last30Days.matchesCreated)}</p>
            <p>Partidos finalizados: {metricNumber(metrics.last30Days.matchesFinished)}</p>
          </div>
        </Card>
      </section>

      <Card>
        <CardTitle>Top organizaciones (por cantidad de jugadores)</CardTitle>
        <CardDescription className="mt-1">
          Ranking operativo para detectar donde hay mas carga de uso y administracion.
        </CardDescription>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-100">
            <thead className="bg-slate-800/80 text-slate-300">
              <tr>
                <th className="px-4 py-3 font-semibold">Organizacion</th>
                <th className="px-4 py-3 font-semibold">Jugadores</th>
                <th className="px-4 py-3 font-semibold">Activos</th>
                <th className="px-4 py-3 font-semibold">Partidos</th>
                <th className="px-4 py-3 font-semibold">Finalizados</th>
                <th className="px-4 py-3 font-semibold">Estado comercial</th>
                <th className="px-4 py-3 font-semibold">Admins</th>
                <th className="px-4 py-3 font-semibold">Invites pendientes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {metrics.topOrganizations.map((organization) => (
                <tr key={organization.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{organization.name}</p>
                    <p className="text-xs text-slate-400">{organization.slug}</p>
                  </td>
                  <td className="px-4 py-3">{metricNumber(organization.players)}</td>
                  <td className="px-4 py-3">{metricNumber(organization.activePlayers)}</td>
                  <td className="px-4 py-3">{metricNumber(organization.matches)}</td>
                  <td className="px-4 py-3">{metricNumber(organization.finishedMatches)}</td>
                  <td className="px-4 py-3">
                    <p>{commercialStatusLabel(organization.commercialStatus)}</p>
                    <p className="text-xs text-slate-400">
                      {organization.subscriptionCurrentPeriodEnd
                        ? `Hasta ${new Date(organization.subscriptionCurrentPeriodEnd).toLocaleDateString("es-AR")}`
                        : `Trial hasta ${new Date(organization.trialEndsAt).toLocaleDateString("es-AR")}`}
                    </p>
                  </td>
                  <td className="px-4 py-3">{metricNumber(organization.admins)}</td>
                  <td className="px-4 py-3">{metricNumber(organization.pendingInvites)}</td>
                </tr>
              ))}
              {!metrics.topOrganizations.length ? (
                <tr>
                  <td className="px-4 py-4 text-slate-400" colSpan={8}>
                    No hay organizaciones cargadas.
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
            1. Totales globales: conteos directos de tablas principales (organizaciones, jugadores, partidos, admins,
            resultados e invitados).
          </p>
          <p>
            2. Metricas derivadas: promedios por organizacion y porcentaje de finalizacion, calculados sobre los datos
            actuales del sistema.
          </p>
          <p>
            3. Actividad 30 dias: compara fechas de creacion/finalizacion contra una ventana movil de 30 dias para
            medir ritmo de crecimiento.
          </p>
          <p>
            4. Recaudacion del mes: suma pagos aprobados de Mercado Pago del mes calendario actual en zona horaria{" "}
            {metrics.currentMonth.timezone}.
          </p>
          <p>
            5. Estado comercial: clasifica cada organizacion entre plan activo, trial gratis o sin plan vigente.
          </p>
          <p>
            6. Export CSV: descarga snapshot con timestamp, metricas globales y detalle por organizacion para analisis
            en BI/Excel.
          </p>
        </div>
      </Card>
    </div>
  );
}
