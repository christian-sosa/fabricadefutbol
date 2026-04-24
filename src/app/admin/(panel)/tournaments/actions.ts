"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { assertAdminAction } from "@/lib/auth/admin";
import { assertTournamentMembershipAction, getTournamentSlugById } from "@/lib/auth/tournaments";
import { ORGANIZATION_BILLING_CURRENCY, TOURNAMENT_MONTHLY_DEBUG_PRICE_ARS } from "@/lib/constants";
import {
  getMercadoPagoWebhookBaseUrl,
  shouldSkipTournamentMercadoPagoCheckout,
  shouldUseMercadoPagoSandboxCheckout
} from "@/lib/env";
import { toUserMessage } from "@/lib/errors";
import { approveTournamentBillingPaymentForDebug } from "@/lib/domain/tournament-billing-workflow";
import { isNextRedirectError } from "@/lib/next-redirect";
import { slugifyTournamentName } from "@/lib/org";
import { createCheckoutProPreference } from "@/lib/payments/mercadopago";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const createTournamentSchema = z.object({
  name: z.string().min(3, "El nombre del torneo debe tener al menos 3 caracteres.").max(100)
});

const MERCADOPAGO_PREFERENCE_TTL_MS = 24 * 60 * 60 * 1000;

function buildTournamentIndexPath(params?: {
  error?: string;
  success?: string;
  checkout?: string;
}) {
  const basePath = "/admin/tournaments";
  const url = new URL(basePath, "http://localhost");
  if (params?.error) url.searchParams.set("error", params.error);
  if (params?.success) url.searchParams.set("success", params.success);
  if (params?.checkout) url.searchParams.set("checkout", params.checkout);
  if (!params?.error && !params?.success && !params?.checkout) return basePath;
  return `${basePath}?${url.searchParams.toString()}`;
}

function stripTrailingSlashes(value: string) {
  return value.replace(/\/+$/, "");
}

function buildMercadoPagoReturnUrl(baseUrl: string, targetPath: string) {
  const url = new URL("/api/payments/mercadopago/return", `${baseUrl}/`);
  url.searchParams.set("target", targetPath);
  return url.toString();
}

function buildMercadoPagoPreferenceExpirationDate() {
  return new Date(Date.now() + MERCADOPAGO_PREFERENCE_TTL_MS).toISOString();
}

async function resolveServerBaseUrl() {
  const configuredPublicBaseUrl = getMercadoPagoWebhookBaseUrl();
  if (configuredPublicBaseUrl) {
    return stripTrailingSlashes(configuredPublicBaseUrl);
  }

  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol =
    headerStore.get("x-forwarded-proto") ?? (host?.includes("localhost") ? "http" : "https");

  if (host) {
    return stripTrailingSlashes(`${protocol}://${host}`);
  }

  throw new Error(
    "No pude resolver la URL base del servidor. Configura MERCADOPAGO_WEBHOOK_BASE_URL o APP_URL."
  );
}

function parseNextSlug(baseSlug: string, existingSlugs: string[]) {
  if (!existingSlugs.includes(baseSlug)) return baseSlug;

  let suffix = 2;
  while (existingSlugs.includes(`${baseSlug}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseSlug}-${suffix}`;
}

function revalidateTournamentPages(tournamentSlug?: string | null) {
  revalidatePath("/admin/tournaments");
  revalidatePath("/tournaments");
  if (tournamentSlug) {
    revalidatePath(`/tournaments/${tournamentSlug}`);
  }
}

export async function createTournamentAction(formData: FormData) {
  try {
    const admin = await assertAdminAction();
    const parsed = createTournamentSchema.safeParse({
      name: formData.get("name")
    });

    if (!parsed.success) {
      redirect(buildTournamentIndexPath({ error: parsed.error.issues[0]?.message ?? "Datos invalidos." }));
    }

    const supabaseAdmin = createSupabaseAdminClient();
    if (!supabaseAdmin) {
      redirect(
        buildTournamentIndexPath({
          error: "Falta SUPABASE_SERVICE_ROLE_KEY para iniciar el pago del torneo."
        })
      );
    }

    const normalizedName = parsed.data.name.trim();
    const { data: existingTournamentByName, error: existingTournamentByNameError } = await supabaseAdmin
      .from("tournaments")
      .select("id")
      .ilike("name", normalizedName)
      .limit(1)
      .maybeSingle();

    if (existingTournamentByNameError) {
      redirect(
        buildTournamentIndexPath({
          error: toUserMessage(existingTournamentByNameError, "No se pudo validar el nombre del torneo.")
        })
      );
    }
    if (existingTournamentByName) {
      redirect(buildTournamentIndexPath({ error: "Ya existe un torneo con ese nombre." }));
    }

    const baseSlug = slugifyTournamentName(normalizedName) || `torneo-${Date.now()}`;
    const { data: existingRows, error: existingError } = await supabaseAdmin
      .from("tournaments")
      .select("slug")
      .ilike("slug", `${baseSlug}%`);

    if (existingError) {
      redirect(
        buildTournamentIndexPath({
          error: toUserMessage(existingError, "No se pudo iniciar el pago del torneo.")
        })
      );
    }

    const requestedSlug = parseNextSlug(
      baseSlug,
      (existingRows ?? []).map((row) => String(row.slug).toLowerCase())
    );
    const externalReference = `tournament-create:${admin.userId}:${Date.now()}:${randomUUID().slice(0, 8)}`;

    const { data: insertedPayment, error: insertPaymentError } = await supabaseAdmin
      .from("tournament_billing_payments")
      .insert({
        admin_id: admin.userId,
        requested_tournament_name: normalizedName,
        requested_tournament_slug: requestedSlug,
        amount: TOURNAMENT_MONTHLY_DEBUG_PRICE_ARS,
        currency_id: ORGANIZATION_BILLING_CURRENCY,
        status: "pending",
        mp_external_reference: externalReference
      })
      .select("id")
      .single();

    if (insertPaymentError || !insertedPayment) {
      redirect(
        buildTournamentIndexPath({
          error: toUserMessage(insertPaymentError, "No se pudo registrar el pago del torneo.")
        })
      );
    }

    if (shouldSkipTournamentMercadoPagoCheckout()) {
      const debugApproval = await approveTournamentBillingPaymentForDebug({
        supabase: supabaseAdmin,
        localPaymentId: insertedPayment.id
      });

      if (!debugApproval.updated || !debugApproval.createdTournamentId) {
        redirect(
          buildTournamentIndexPath({
            error:
              "reason" in debugApproval && debugApproval.reason
                ? debugApproval.reason
                : "No se pudo simular el pago del torneo."
          })
        );
      }

      redirect(
        `/admin/tournaments/${debugApproval.createdTournamentId}?success=${encodeURIComponent(
          "Torneo creado con pago simulado para debug."
        )}`
      );
    }

    const publicBaseUrl = await resolveServerBaseUrl();
    const successPath = "/admin/tournaments?checkout=success";
    const failurePath = "/admin/tournaments?checkout=failure";
    const pendingPath = "/admin/tournaments?checkout=pending";
    const notificationPath = "/api/payments/mercadopago/webhook";

    const preference = await createCheckoutProPreference({
      title: `Crear torneo (${normalizedName})`,
      unitPrice: TOURNAMENT_MONTHLY_DEBUG_PRICE_ARS,
      currencyId: ORGANIZATION_BILLING_CURRENCY,
      quantity: 1,
      externalReference,
      notificationUrl: `${publicBaseUrl}${notificationPath}`,
      successUrl: buildMercadoPagoReturnUrl(publicBaseUrl, successPath),
      failureUrl: buildMercadoPagoReturnUrl(publicBaseUrl, failurePath),
      pendingUrl: buildMercadoPagoReturnUrl(publicBaseUrl, pendingPath),
      expiresAt: buildMercadoPagoPreferenceExpirationDate(),
      payerEmail: admin.email,
      metadata: {
        purpose: "tournament_creation",
        admin_id: admin.userId,
        tournament_billing_payment_id: insertedPayment.id
      }
    });

    const { error: updatePaymentError } = await supabaseAdmin
      .from("tournament_billing_payments")
      .update({
        mp_preference_id: preference.id,
        checkout_url: preference.init_point,
        checkout_sandbox_url: preference.sandbox_init_point
      })
      .eq("id", insertedPayment.id);

    if (updatePaymentError) {
      redirect(
        buildTournamentIndexPath({
          error: toUserMessage(updatePaymentError, "No se pudo guardar la preferencia de pago.")
        })
      );
    }

    const redirectUrl = shouldUseMercadoPagoSandboxCheckout()
      ? preference.sandbox_init_point ?? preference.init_point
      : preference.init_point ?? preference.sandbox_init_point;

    if (!redirectUrl) {
      redirect(
        buildTournamentIndexPath({
          error: "Mercado Pago no devolvio una URL valida para continuar el pago."
        })
      );
    }

    redirect(redirectUrl);
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(
      buildTournamentIndexPath({
        error: toUserMessage(error, "No se pudo iniciar el pago del torneo.")
      })
    );
  }
}

export async function archiveTournamentAction(formData: FormData) {
  try {
    const tournamentId = String(formData.get("tournamentId") ?? "");
    if (!tournamentId) {
      redirect(buildTournamentIndexPath({ error: "Falta el torneo a archivar." }));
    }

    await assertTournamentMembershipAction(tournamentId);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("tournaments")
      .update({ status: "archived" })
      .eq("id", tournamentId);

    if (error) {
      redirect(buildTournamentIndexPath({ error: toUserMessage(error, "No se pudo archivar el torneo.") }));
    }

    const slug = await getTournamentSlugById(tournamentId);
    revalidateTournamentPages(slug);
    redirect(buildTournamentIndexPath({ success: "Torneo archivado." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildTournamentIndexPath({ error: toUserMessage(error, "No se pudo archivar el torneo.") }));
  }
}
