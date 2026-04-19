import {
  startOrganizationCheckoutProAction,
  syncOrganizationCheckoutPaymentAction
} from "@/app/admin/(panel)/actions";
import { OrganizationSwitcher } from "@/components/layout/organization-switcher";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import {
  getOrganizationWriteAccess,
  requireAdminOrganization
} from "@/lib/auth/admin";
import { syncOrganizationBillingPaymentFromMercadoPago } from "@/lib/domain/billing-workflow";
import {
  ORGANIZATION_BILLING_CURRENCY,
  ORGANIZATION_MONTHLY_PRICE_ARS
} from "@/lib/constants";
import { getOrganizationBillingData } from "@/lib/queries/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/utils";

function formatCurrencyArs(amount: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: ORGANIZATION_BILLING_CURRENCY,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

function normalizePaymentStatusLabel(status: string) {
  switch (status.toLowerCase()) {
    case "active":
      return "Activa";
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

function normalizePaymentPurposeLabel(purpose: string | null | undefined) {
  if ((purpose ?? "").toLowerCase() === "organization_creation") {
    return "Alta de nueva organizacion";
  }
  return "Suscripcion mensual";
}

export default async function AdminBillingPage({
  searchParams
}: {
  searchParams: Promise<{
    org?: string;
    error?: string;
    checkout?: string;
    payment_id?: string;
  }>;
}) {
  const resolvedSearchParams = await searchParams;
  const { admin, organizations, selectedOrganization } = await requireAdminOrganization(
    resolvedSearchParams.org
  );
  const writeAccess = await getOrganizationWriteAccess(admin, selectedOrganization.id);

  if (resolvedSearchParams.payment_id) {
    try {
      const supabaseAdmin = createSupabaseAdminClient();
      if (supabaseAdmin) {
        await syncOrganizationBillingPaymentFromMercadoPago({
          supabase: supabaseAdmin,
          mercadopagoPaymentId: resolvedSearchParams.payment_id,
          expectedOrganizationId: selectedOrganization.id
        });
      }
    } catch {
      // No bloquea la pantalla de billing si la sincronizacion puntual falla.
    }
  }

  const billingData = await getOrganizationBillingData(selectedOrganization.id);
  const subscription = billingData.subscription;
  const isSubscriptionActive = writeAccess.subscriptionActive;
  const periodEndsAt = subscription?.current_period_end ?? null;
  const accessValidUntil = periodEndsAt ?? writeAccess.organizationTrialEndsAt ?? null;
  const subscriptionStatusLabel = subscription?.status
    ? normalizePaymentStatusLabel(subscription.status)
    : writeAccess.organizationTrialExpired
      ? "Sin suscripcion activa"
      : "Prueba gratuita activa";

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Facturacion</CardTitle>
        <CardDescription>
          Mercado Pago por organizacion: {formatCurrencyArs(ORGANIZATION_MONTHLY_PRICE_ARS)} / 30
          dias.
        </CardDescription>
        <div className="mt-3">
          <OrganizationSwitcher
            basePath="/admin/billing"
            currentOrganizationSlug={selectedOrganization.slug}
            label="Cambiar organizacion"
            organizations={organizations}
          />
        </div>
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
              ? "Estamos validando el pago. Si se aprobo, el acceso se activa automaticamente."
              : resolvedSearchParams.checkout === "pending"
                ? "El pago quedo pendiente. Puedes sincronizarlo con el boton de abajo."
                : resolvedSearchParams.checkout === "sync"
                  ? "Se refresco el estado del pago desde Mercado Pago."
                  : "No se pudo completar el checkout. Puedes intentarlo de nuevo."}
          </CardDescription>
          {resolvedSearchParams.payment_id ? (
            <form action={syncOrganizationCheckoutPaymentAction} className="mt-3">
              <input name="organizationId" type="hidden" value={selectedOrganization.id} />
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

      <Card>
        <CardTitle>Estado del acceso</CardTitle>
        <div className="mt-3 space-y-2 text-sm text-slate-200">
          <p>
            Organizacion: <span className="font-semibold">{selectedOrganization.name}</span>
          </p>
          <p>
            Suscripcion valida hasta:{" "}
            <span className="font-semibold">
              {accessValidUntil
                ? new Date(accessValidUntil).toLocaleDateString("es-AR")
                : "-"}
            </span>
          </p>
          <p>
            Estado del plan:{" "}
            <span className="font-semibold">
              {subscriptionStatusLabel}
            </span>
          </p>
        </div>

        {!writeAccess.canWrite ? (
          <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
            <p className="text-sm font-semibold text-amber-100">{writeAccess.reason}</p>
            <form action={startOrganizationCheckoutProAction} className="mt-3">
              <input name="organizationId" type="hidden" value={selectedOrganization.id} />
              <Button type="submit">
                Pagar {formatCurrencyArs(ORGANIZATION_MONTHLY_PRICE_ARS)} y activar 30 dias
              </Button>
            </form>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3">
            <p className="text-sm font-semibold text-emerald-100">
              Escritura habilitada ({isSubscriptionActive ? "suscripcion activa" : "trial vigente"}).
            </p>
            <form action={startOrganizationCheckoutProAction} className="mt-3">
              <input name="organizationId" type="hidden" value={selectedOrganization.id} />
              <Button type="submit" variant="secondary">
                Comprar otro mes
              </Button>
            </form>
          </div>
        )}
      </Card>

      <Card>
        <CardTitle>Historial de pagos</CardTitle>
        <CardDescription>Ultimos intentos de pago en Mercado Pago para esta organizacion.</CardDescription>
        <div className="mt-3 space-y-2">
          {billingData.payments.length ? (
            billingData.payments.map((payment) => (
              <div
                className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-sm"
                key={payment.id}
              >
                <p className="font-semibold text-slate-100">
                  {normalizePaymentStatusLabel(payment.status)} |{" "}
                  {formatCurrencyArs(Number(payment.amount))}
                </p>
                <p className="text-xs text-slate-400">
                  Motivo: {normalizePaymentPurposeLabel(payment.purpose)}
                </p>
                <p className="text-xs text-slate-400">
                  Creado: {formatDateTime(payment.created_at)} | Ref:{" "}
                  {payment.mp_external_reference ?? "-"}
                </p>
                <p className="text-xs text-slate-400">
                  Pago MP: {payment.mp_payment_id ?? "-"} | Preferencia:{" "}
                  {payment.mp_preference_id ?? "-"}
                </p>
                <p className="text-xs text-slate-400">
                  Aprobado: {payment.approved_at ? formatDateTime(payment.approved_at) : "-"} | Cobertura:{" "}
                  {payment.period_start && payment.period_end
                    ? `${new Date(payment.period_start).toLocaleDateString("es-AR")} -> ${new Date(
                        payment.period_end
                      ).toLocaleDateString("es-AR")}`
                    : "-"}
                </p>
                {payment.status === "pending" && !payment.mp_payment_id ? (
                  <p className="text-xs text-amber-300">
                    Todavia no hay un pago confirmado en Mercado Pago para este intento.
                  </p>
                ) : null}
                {payment.created_organization_id ? (
                  <p className="text-xs text-emerald-300">
                    Organizacion creada automaticamente con este pago.
                  </p>
                ) : null}
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-400">Aun no hay pagos registrados.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
