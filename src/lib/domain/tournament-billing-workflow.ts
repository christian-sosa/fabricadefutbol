import { getMercadoPagoPaymentById } from "@/lib/payments/mercadopago";
import { slugifyTournamentName } from "@/lib/org";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type DbClient =
  | Awaited<ReturnType<typeof createSupabaseServerClient>>
  | NonNullable<ReturnType<typeof createSupabaseAdminClient>>;

type LeagueBillingPaymentRow = {
  id: string;
  admin_id: string;
  requested_league_name: string;
  requested_league_slug: string;
  created_league_id: string | null;
  mp_external_reference: string | null;
  mp_payment_id: string | null;
  status: string;
};

function normalizePaymentStatus(status: string | null | undefined) {
  return (status ?? "unknown").toLowerCase();
}

function parseNextSlug(baseSlug: string, existingSlugs: string[]) {
  if (!existingSlugs.includes(baseSlug)) return baseSlug;

  let suffix = 2;
  while (existingSlugs.includes(`${baseSlug}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseSlug}-${suffix}`;
}

async function findLeagueBillingPaymentRow(params: {
  supabase: DbClient;
  paymentId: string;
  externalReference: string | null;
}) {
  const { supabase, paymentId, externalReference } = params;

  const byPaymentId = await supabase
    .from("league_billing_payments")
    .select("*")
    .eq("mp_payment_id", paymentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (byPaymentId.error) throw new Error(byPaymentId.error.message);
  if (byPaymentId.data) return byPaymentId.data as LeagueBillingPaymentRow;

  if (!externalReference) return null;

  const byExternalReference = await supabase
    .from("league_billing_payments")
    .select("*")
    .eq("mp_external_reference", externalReference)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (byExternalReference.error) throw new Error(byExternalReference.error.message);
  if (!byExternalReference.data) return null;
  return byExternalReference.data as LeagueBillingPaymentRow;
}

async function createLeagueFromApprovedPayment(params: {
  supabase: DbClient;
  paymentRow: LeagueBillingPaymentRow;
}) {
  const { supabase, paymentRow } = params;
  if (paymentRow.created_league_id) return paymentRow.created_league_id;

  const requestedName = paymentRow.requested_league_name?.trim();
  const requestedByAdminId = paymentRow.admin_id?.trim();
  if (!requestedName || !requestedByAdminId) return null;

  const existingLeague = await supabase
    .from("leagues")
    .select("id, created_by")
    .ilike("name", requestedName)
    .maybeSingle();

  if (existingLeague.error) throw new Error(existingLeague.error.message);
  if (existingLeague.data) {
    if (existingLeague.data.created_by !== requestedByAdminId) {
      throw new Error("Ya existe una liga con ese nombre.");
    }

    const existingLeagueId = String(existingLeague.data.id);
    const { error: markExistingError } = await supabase
      .from("league_billing_payments")
      .update({
        created_league_id: existingLeagueId
      })
      .eq("id", paymentRow.id)
      .is("created_league_id", null);

    if (markExistingError) throw new Error(markExistingError.message);
    paymentRow.created_league_id = existingLeagueId;
    return existingLeagueId;
  }

  const baseSlug =
    slugifyTournamentName(paymentRow.requested_league_slug?.trim() || requestedName) ||
    `liga-${Date.now()}`;
  const { data: existingRows, error: existingRowsError } = await supabase
    .from("leagues")
    .select("slug")
    .ilike("slug", `${baseSlug}%`);

  if (existingRowsError) throw new Error(existingRowsError.message);

  const slug = parseNextSlug(
    baseSlug,
    (existingRows ?? []).map((row) => String(row.slug).toLowerCase())
  );

  const { data: league, error: insertLeagueError } = await supabase
    .from("leagues")
    .insert({
      name: requestedName,
      slug,
      description: null,
      venue_name: null,
      location_notes: null,
      is_public: true,
      status: "draft",
      created_by: requestedByAdminId
    })
    .select("id")
    .single();

  if (insertLeagueError || !league) {
    throw new Error(insertLeagueError?.message ?? "No se pudo crear la liga.");
  }

  const { error: membershipError } = await supabase.from("league_admins").insert({
    league_id: league.id,
    admin_id: requestedByAdminId,
    role: "owner",
    created_by: requestedByAdminId
  });

  if (membershipError && membershipError.code !== "23505") {
    throw new Error(membershipError.message);
  }

  const { error: markCreatedError } = await supabase
    .from("league_billing_payments")
    .update({
      created_league_id: league.id
    })
    .eq("id", paymentRow.id);

  if (markCreatedError) throw new Error(markCreatedError.message);

  paymentRow.created_league_id = String(league.id);
  return paymentRow.created_league_id;
}

export async function approveTournamentBillingPaymentForDebug(params: {
  supabase: DbClient;
  localPaymentId: string;
}) {
  const { supabase, localPaymentId } = params;
  const paymentResult = await supabase
    .from("league_billing_payments")
    .select("*")
    .eq("id", localPaymentId)
    .maybeSingle();

  if (paymentResult.error) throw new Error(paymentResult.error.message);
  if (!paymentResult.data) {
    return {
      updated: false,
      reason: "No hay orden local asociada para este pago."
    };
  }

  const paymentRow = paymentResult.data as LeagueBillingPaymentRow;
  const approvedAt = new Date().toISOString();
  const simulatedPaymentId = paymentRow.mp_payment_id?.trim() || `debug-skip-${paymentRow.id}`;

  const { error: updatePaymentError } = await supabase
    .from("league_billing_payments")
    .update({
      mp_payment_id: simulatedPaymentId,
      status: "approved",
      approved_at: approvedAt,
      raw_payment: {
        id: simulatedPaymentId,
        status: "approved",
        external_reference: paymentRow.mp_external_reference,
        date_approved: approvedAt,
        debug_skip_checkout: true
      }
    })
    .eq("id", paymentRow.id);

  if (updatePaymentError) throw new Error(updatePaymentError.message);

  const createdLeagueId = await createLeagueFromApprovedPayment({
    supabase,
    paymentRow
  });

  return {
    updated: true,
    localPaymentId: paymentRow.id,
    status: "approved",
    createdLeagueId,
    createdTournamentId: createdLeagueId,
    skippedCheckout: true
  };
}

export async function syncTournamentBillingPaymentFromMercadoPago(params: {
  supabase: DbClient;
  mercadopagoPaymentId: string | number;
}) {
  const { supabase, mercadopagoPaymentId } = params;
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

  const paymentRow = await findLeagueBillingPaymentRow({
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

  const approvedAt = payment.date_approved ?? null;
  const { error: updatePaymentError } = await supabase
    .from("league_billing_payments")
    .update({
      mp_payment_id: paymentId,
      status: normalizedStatus,
      approved_at: approvedAt,
      raw_payment: payment
    })
    .eq("id", paymentRow.id);

  if (updatePaymentError) throw new Error(updatePaymentError.message);

  let createdLeagueId: string | null = paymentRow.created_league_id;
  if (normalizedStatus === "approved") {
    createdLeagueId = await createLeagueFromApprovedPayment({
      supabase,
      paymentRow
    });
  }

  return {
    updated: true,
    localPaymentId: paymentRow.id,
    status: normalizedStatus,
    createdLeagueId,
    createdTournamentId: createdLeagueId
  };
}
