import Link from "next/link";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getAdminLeagueBillingData } from "@/lib/queries/tournaments";
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
    default:
      return status;
  }
}

export default async function AdminTournamentBillingPage() {
  const data = await getAdminLeagueBillingData();

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Facturacion de ligas</CardTitle>
        <CardDescription className="mt-2">
          El cobro se asocia al alta de una liga. Crear competencias nuevas dentro de una liga ya creada no dispara un nuevo checkout.
        </CardDescription>
      </Card>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardDescription>Pagos registrados</CardDescription>
          <CardTitle className="mt-1 text-3xl">{data.payments.length}</CardTitle>
        </Card>
        <Card>
          <CardDescription>Ligas creadas desde pago</CardDescription>
          <CardTitle className="mt-1 text-3xl">
            {data.payments.filter((payment) => payment.createdLeague).length}
          </CardTitle>
        </Card>
        <Card>
          <CardDescription>Recordatorio</CardDescription>
          <CardTitle className="mt-1 text-xl">Competencias sin costo extra</CardTitle>
        </Card>
      </section>

      <Card>
        <CardTitle>Historial de pagos</CardTitle>
        <CardDescription className="mt-2">
          Aqui ves los intentos de checkout del modulo Torneos y, si aplica, la liga que quedo asociada al pago.
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
                      Aprobado: {payment.approved_at ? formatDateTime(payment.approved_at) : "-"}
                    </p>
                  </div>

                  <div className="flex flex-col items-start gap-2 text-xs">
                    {payment.createdLeague ? (
                      <Link
                        className="font-semibold text-emerald-300 hover:underline"
                        href={`/admin/tournaments/${payment.createdLeague.id}`}
                      >
                        Abrir liga creada
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
