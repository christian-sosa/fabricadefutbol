import Link from "next/link";

import {
  startLeagueCheckoutAction,
  syncLeagueBillingPaymentAction
} from "@/app/admin/(panel)/tournaments/actions";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { syncTournamentBillingPaymentFromMercadoPago } from "@/lib/domain/tournament-billing-workflow";
import { getAdminLeagueBillingData } from "@/lib/queries/tournaments";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/utils";

function formatCurrency(amount: number, currency: string | null | undefined) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: currency || "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

function normalizePaymentStatusLabel(status: string) {
  switch (status.toLowerCase()) {
    case "active":
      return "Activo";
    case "approved":
      return "Aprobado";
    case "pending":
      return "Pendiente";
    case "in_process":
      return "En proceso";
    case "rejected":
      return "Rechazado";
    case "cancelled":
      return "Cancelado";
    case "refunded":
      return "Reintegrado";
    case "expired":
      return "Vencido";
    default:
      return status;
  }
}

function normalizePaymentPurposeLabel(purpose: string | null | undefined) {
  return (purpose ?? "").toLowerCase() === "league_subscription"
    ? "Renovacion mensual"
    : "Alta de liga";
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-AR");
}

export default async function AdminTournamentBillingPage({
  searchParams
}: {
  searchParams: Promise<{
    checkout?: string;
    error?: string;
    league?: string;
    payment_id?: string;
  }>;
}) {
  const resolvedSearchParams = await searchParams;

  if (resolvedSearchParams.payment_id) {
    try {
      const supabaseAdmin = createSupabaseAdminClient();
      if (supabaseAdmin) {
        await syncTournamentBillingPaymentFromMercadoPago({
          supabase: supabaseAdmin,
          mercadopagoPaymentId: resolvedSearchParams.payment_id
        });
      }
    } catch {
      // No bloquea la pantalla si la sincronizacion puntual falla.
    }
  }

  const data = await getAdminLeagueBillingData();
  const activeLeagueCount = data.leagues.filter((item) => item.access.canWrite).length;
  const readOnlyLeagueCount = data.leagues.filter((item) => !item.access.canWrite).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Facturacion de ligas</CardTitle>
        <CardDescription className="mt-2">
          Cada liga se paga mes a mes. No hay mes gratis en Torneos y crear competencias nuevas no genera un checkout extra.
        </CardDescription>
      </Card>

      {resolvedSearchParams.checkout ? (
        <Card
          className={
            resolvedSearchParams.checkout === "failure"
              ? "border-danger/40 bg-danger/10"
              : "border-emerald-500/30 bg-emerald-500/10"
          }
        >
          <CardTitle>
            {resolvedSearchParams.checkout === "success"
              ? "Pago iniciado"
              : resolvedSearchParams.checkout === "pending"
                ? "Pago pendiente"
                : resolvedSearchParams.checkout === "sync"
                  ? "Pago sincronizado"
                  : "Pago cancelado"}
          </CardTitle>
          <CardDescription className="mt-1">
            {resolvedSearchParams.checkout === "success"
              ? "Estamos validando el pago. Si se aprueba, la liga extiende automaticamente su acceso por otro mes."
              : resolvedSearchParams.checkout === "pending"
                ? "El pago quedo pendiente. Puedes revalidarlo desde aca si Mercado Pago ya lo aprobó."
                : resolvedSearchParams.checkout === "sync"
                  ? "Se actualizo el estado del pago desde Mercado Pago."
                  : "No se pudo completar el checkout. Puedes intentarlo de nuevo cuando quieras."}
          </CardDescription>
          {resolvedSearchParams.payment_id && resolvedSearchParams.league ? (
            <form action={syncLeagueBillingPaymentAction} className="mt-3">
              <input name="leagueId" type="hidden" value={resolvedSearchParams.league} />
              <input name="paymentId" type="hidden" value={resolvedSearchParams.payment_id} />
              <Button type="submit" variant="secondary">
                Revalidar pago #{resolvedSearchParams.payment_id}
              </Button>
            </form>
          ) : null}
        </Card>
      ) : null}

      {resolvedSearchParams.error ? (
        <Card className="border-danger/40 bg-danger/10">
          <CardTitle>Error de facturacion</CardTitle>
          <CardDescription className="mt-1">{resolvedSearchParams.error}</CardDescription>
        </Card>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-4">
        <Card>
          <CardDescription>Ligas administradas</CardDescription>
          <CardTitle className="mt-1 text-3xl">{data.leagues.length}</CardTitle>
        </Card>
        <Card>
          <CardDescription>Edicion habilitada</CardDescription>
          <CardTitle className="mt-1 text-3xl">{activeLeagueCount}</CardTitle>
        </Card>
        <Card>
          <CardDescription>Solo lectura</CardDescription>
          <CardTitle className="mt-1 text-3xl">{readOnlyLeagueCount}</CardTitle>
        </Card>
        <Card>
          <CardDescription>Recordatorio</CardDescription>
          <CardTitle className="mt-1 text-xl">Competencias sin costo extra</CardTitle>
        </Card>
      </section>

      <Card>
        <CardTitle>Estado del acceso</CardTitle>
        <CardDescription className="mt-2">
          Aqui ves hasta cuando puedes seguir editando cada liga. Cuando vence, la liga queda en modo lectura hasta que se pague otro mes.
        </CardDescription>
        <div className="mt-4 space-y-3">
          {data.leagues.length ? (
            data.leagues.map((item) => (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4" key={item.league.id}>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-semibold text-slate-100">{item.league.name}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Estado del acceso: <span className="font-semibold text-slate-200">{item.access.accessLabel}</span>
                    </p>
                    <p className="text-xs text-slate-400">
                      Plan actual:{" "}
                      <span className="font-semibold text-slate-200">
                        {item.access.subscriptionStatus
                          ? normalizePaymentStatusLabel(item.access.subscriptionStatus)
                          : "Sin mes activo"}
                      </span>
                    </p>
                    <p className="text-xs text-slate-400">
                      Mes actual:{" "}
                      <span className="font-semibold text-slate-200">
                        {item.access.accessStartsAt
                          ? `${formatShortDate(item.access.accessStartsAt)} al ${formatShortDate(item.access.accessValidUntil)}`
                          : item.access.accessValidUntil
                            ? `hasta ${formatShortDate(item.access.accessValidUntil)}`
                            : "Sin periodo activo"}
                      </span>
                    </p>
                    <p className="text-xs text-slate-400">
                      Acceso valido hasta:{" "}
                      <span className="font-semibold text-slate-200">
                        {formatShortDate(item.access.accessValidUntil)}
                      </span>
                    </p>
                    <p className="text-xs text-slate-400">
                      Ultimo pago aplicado:{" "}
                      <span className="font-semibold text-slate-200">
                        {formatShortDate(item.access.lastPaymentAt)}
                      </span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      className="text-sm font-semibold text-emerald-300 hover:underline"
                      href={`/admin/tournaments/${item.league.id}`}
                    >
                      Abrir liga
                    </Link>
                    <form action={startLeagueCheckoutAction}>
                      <input name="leagueId" type="hidden" value={item.league.id} />
                      <Button type="submit" variant={item.access.canWrite ? "secondary" : "primary"}>
                        {item.access.canWrite ? "Comprar otro mes" : "Pagar y reactivar"}
                      </Button>
                    </form>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-400">Todavia no administras ninguna liga.</p>
          )}
        </div>
      </Card>

      <Card>
        <CardTitle>Historial de pagos</CardTitle>
        <CardDescription className="mt-2">
          Aqui ves las altas y renovaciones mensuales del modulo Torneos.
        </CardDescription>
        <div className="mt-4 space-y-3">
          {data.payments.length ? (
            data.payments.map((payment) => (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm" key={payment.id}>
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-semibold text-slate-100">
                      {normalizePaymentStatusLabel(payment.status)} · {formatCurrency(Number(payment.amount), payment.currency_id)}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Motivo: {normalizePaymentPurposeLabel(payment.purpose)}
                    </p>
                    <p className="text-xs text-slate-400">
                      Liga pedida: {payment.requested_league_name}
                      {payment.requested_league_slug ? ` (${payment.requested_league_slug})` : ""}
                    </p>
                    <p className="text-xs text-slate-400">
                      Creado: {formatDateTime(payment.created_at)} · MP ref: {payment.mp_external_reference ?? "-"}
                    </p>
                    <p className="text-xs text-slate-400">
                      Pago MP: {payment.mp_payment_id ?? "-"} · Preferencia: {payment.mp_preference_id ?? "-"}
                    </p>
                    <p className="text-xs text-slate-400">
                      Aprobado: {payment.approved_at ? formatDateTime(payment.approved_at) : "-"} · Cobertura:{" "}
                      {payment.period_start && payment.period_end
                        ? `${formatShortDate(payment.period_start)} -> ${formatShortDate(payment.period_end)}`
                        : "-"}
                    </p>
                  </div>

                  <div className="flex flex-col items-start gap-2 text-xs">
                    {payment.createdLeague ? (
                      <Link
                        className="font-semibold text-emerald-300 hover:underline"
                        href={`/admin/tournaments/${payment.createdLeague.id}`}
                      >
                        Abrir liga
                      </Link>
                    ) : (
                      <span className="text-slate-500">Todavia sin liga asociada</span>
                    )}
                    {payment.checkout_url ? (
                      <Link
                        className="font-semibold text-sky-300 hover:underline"
                        href={payment.checkout_url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Ver checkout
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-400">Aun no hay pagos registrados para ligas.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
