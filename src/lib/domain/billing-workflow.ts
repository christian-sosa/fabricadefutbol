import { resolveNextOrganizationBillingPeriod } from "@/lib/domain/billing";
import { getMercadoPagoPaymentById } from "@/lib/payments/mercadopago";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type DbClient =
  | Awaited<ReturnType<typeof createSupabaseServerClient>>
  | NonNullable<ReturnType<typeof createSupabaseAdminClient>>;

type BillingPaymentRow = {
  id: string;
  organization_id: string;
  mp_external_reference: string | null;
  mp_payment_id: string | null;
  status: string;
  created_at?: string | null;
  subscription_applied_at: string | null;
  purpose: string | null;
  requested_organization_name: string | null;
  requested_organization_slug: string | null;
  requested_by_admin_id: string | null;
  created_organization_id: string | null;
};

const STALE_PENDING_PAYMENT_TTL_MS = 24 * 60 * 60 * 1000;

function normalizePaymentStatus(status: string | null | undefined) {
  return (status ?? "unknown").toLowerCase();
}

function isStalePendingBillingPayment(
  paymentRow: Pick<BillingPaymentRow, "created_at" | "mp_payment_id" | "status">,
  now = Date.now()
) {
  if (normalizePaymentStatus(paymentRow.status) !== "pending") return false;
  if (paymentRow.mp_payment_id) return false;
  if (!paymentRow.created_at) return false;

  const createdAt = new Date(paymentRow.created_at).getTime();
  if (!Number.isFinite(createdAt)) return false;
  return now - createdAt >= STALE_PENDING_PAYMENT_TTL_MS;
}

export async function cleanupStalePendingOrganizationBillingPayments(params: {
  supabase: DbClient;
  organizationId: string;
  now?: number;
}) {
  const { supabase, organizationId, now } = params;

  const { data: pendingRows, error: pendingRowsError } = await supabase
    .from("organization_billing_payments")
    .select("id, status, mp_payment_id, created_at")
    .eq("organization_id", organizationId)
    .eq("status", "pending")
    .is("mp_payment_id", null);
  if (pendingRowsError) throw new Error(pendingRowsError.message);

  const staleIds = (pendingRows ?? [])
    .filter((row) =>
      isStalePendingBillingPayment(
        {
          created_at: typeof row.created_at === "string" ? row.created_at : null,
          mp_payment_id: typeof row.mp_payment_id === "string" ? row.mp_payment_id : null,
          status: typeof row.status === "string" ? row.status : "pending"
        },
        now
      )
    )
    .map((row) => String(row.id));

  if (!staleIds.length) return 0;

  const { error: deleteError } = await supabase
    .from("organization_billing_payments")
    .delete()
    .in("id", staleIds);
  if (deleteError) throw new Error(deleteError.message);

  return staleIds.length;
}

async function findBillingPaymentRow(params: {
  supabase: DbClient;
  paymentId: string;
  externalReference: string | null;
}) {
  const { supabase, paymentId, externalReference } = params;

  const byPaymentId = await supabase
    .from("organization_billing_payments")
    .select("*")
    .eq("mp_payment_id", paymentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (byPaymentId.error) throw new Error(byPaymentId.error.message);
  if (byPaymentId.data) return byPaymentId.data as BillingPaymentRow;

  if (!externalReference) return null;

  const byExternalReference = await supabase
    .from("organization_billing_payments")
    .select("*")
    .eq("mp_external_reference", externalReference)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (byExternalReference.error) throw new Error(byExternalReference.error.message);
  if (!byExternalReference.data) return null;
  return byExternalReference.data as BillingPaymentRow;
}

async function applyApprovedPaymentPeriod(params: {
  supabase: DbClient;
  paymentRow: BillingPaymentRow;
  approvedAt: string;
  targetOrganizationId?: string;
}) {
  const { supabase, paymentRow, approvedAt, targetOrganizationId } = params;
  if (paymentRow.subscription_applied_at) return;
  const organizationId = targetOrganizationId ?? paymentRow.organization_id;

  const { data: subscription, error: subscriptionError } = await supabase
    .from("organization_billing_subscriptions")
    .select("organization_id, current_period_end")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (subscriptionError) throw new Error(subscriptionError.message);

  const { periodStart, periodEnd } = resolveNextOrganizationBillingPeriod(
    subscription?.current_period_end ?? null
  );

  const { error: upsertSubscriptionError } = await supabase
    .from("organization_billing_subscriptions")
    .upsert(
      {
        organization_id: organizationId,
        status: "active",
        current_period_start: periodStart,
        current_period_end: periodEnd,
        last_payment_at: approvedAt
      },
      { onConflict: "organization_id" }
    );
  if (upsertSubscriptionError) throw new Error(upsertSubscriptionError.message);

  // Guard atomico: solo una ejecucion concurrente puede pasar el WHERE.
  // El WHERE adicional `subscription_applied_at IS NULL` evita doble aplicacion
  // si el webhook llega dos veces casi simultaneamente.
  const { data: markedRows, error: markAppliedError } = await supabase
    .from("organization_billing_payments")
    .update({
      period_start: periodStart,
      period_end: periodEnd,
      subscription_applied_at: new Date().toISOString()
    })
    .eq("id", paymentRow.id)
    .is("subscription_applied_at", null)
    .select("id");
  if (markAppliedError) throw new Error(markAppliedError.message);
  if (!markedRows || markedRows.length === 0) {
    // Otro proceso ya aplico este pago; no hay nada mas que hacer.
    return;
  }
}

async function createOrganizationFromApprovedPayment(params: {
  supabase: DbClient;
  paymentRow: BillingPaymentRow;
}) {
  const { supabase, paymentRow } = params;
  const { data, error } = await supabase.rpc("finalize_organization_creation_payment", {
    payment_row_id: paymentRow.id
  });

  if (error) {
    throw new Error(error.message);
  }

  return typeof data === "string" ? data : null;
}

async function reassignCreationPaymentToCreatedOrganization(params: {
  supabase: DbClient;
  paymentRow: BillingPaymentRow;
  createdOrganizationId: string;
}) {
  const { supabase, paymentRow, createdOrganizationId } = params;
  if (paymentRow.organization_id === createdOrganizationId) return;

  const { error: updatePaymentError } = await supabase
    .from("organization_billing_payments")
    .update({
      organization_id: createdOrganizationId
    })
    .eq("id", paymentRow.id);
  if (updatePaymentError) throw new Error(updatePaymentError.message);

  paymentRow.organization_id = createdOrganizationId;
}

export async function syncOrganizationBillingPaymentFromMercadoPago(params: {
  supabase: DbClient;
  mercadopagoPaymentId: string | number;
  /**
   * Si se provee, exige que el pago local localizado pertenezca a esta organizacion.
   * Evita que un admin pueda sincronizar pagos de otra organizacion pasando
   * un paymentId ajeno.
   */
  expectedOrganizationId?: string;
}) {
  const { supabase, mercadopagoPaymentId, expectedOrganizationId } = params;
  let payment;
  try {
    payment = await getMercadoPagoPaymentById(mercadopagoPaymentId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Mercado Pago API error (404)")) {
      return {
        updated: false,
        reason: "Pago no encontrado en Mercado Pago. Puede ser un webhook de prueba."
      };
    }
    throw error;
  }

  const paymentId = String(payment.id);
  const externalReference = payment.external_reference?.trim() || null;
  const normalizedStatus = normalizePaymentStatus(payment.status);

  const paymentRow = await findBillingPaymentRow({
    supabase,
    paymentId,
    externalReference
  });
  if (!paymentRow) {
    return {
      updated: false,
      reason: "No hay orden local asociada para este pago."
    };
  }

  if (expectedOrganizationId && paymentRow.organization_id !== expectedOrganizationId) {
    return {
      updated: false,
      reason: "El pago no pertenece a esta organizacion."
    };
  }

  const approvedAt = payment.date_approved ?? null;
  const { error: updatePaymentError } = await supabase
    .from("organization_billing_payments")
    .update({
      mp_payment_id: paymentId,
      status: normalizedStatus,
      approved_at: approvedAt,
      raw_payment: payment
    })
    .eq("id", paymentRow.id);
  if (updatePaymentError) throw new Error(updatePaymentError.message);

  if (normalizedStatus === "approved") {
    const normalizedPurpose = (paymentRow.purpose ?? "organization_subscription").toLowerCase();

    if (normalizedPurpose === "organization_creation") {
      const createdOrganizationId = await createOrganizationFromApprovedPayment({
        supabase,
        paymentRow
      });

      if (createdOrganizationId) {
        await reassignCreationPaymentToCreatedOrganization({
          supabase,
          paymentRow,
          createdOrganizationId
        });

        await applyApprovedPaymentPeriod({
          supabase,
          paymentRow,
          approvedAt: approvedAt ?? new Date().toISOString(),
          targetOrganizationId: createdOrganizationId
        });
      }

      return {
        updated: true,
        organizationId: paymentRow.organization_id,
        localPaymentId: paymentRow.id,
        status: normalizedStatus,
        createdOrganizationId
      };
    }

    await applyApprovedPaymentPeriod({
      supabase,
      paymentRow,
      approvedAt: approvedAt ?? new Date().toISOString()
    });
  }

  return {
    updated: true,
    organizationId: paymentRow.organization_id,
    localPaymentId: paymentRow.id,
    status: normalizedStatus,
    createdOrganizationId: null as string | null
  };
}
