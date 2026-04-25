"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { assertAdminAction } from "@/lib/auth/admin";
import {
  assertLeagueMembershipAction,
  assertLeagueWriteAction,
  getLeagueSlugById
} from "@/lib/auth/tournaments";
import {
  ORGANIZATION_BILLING_CURRENCY,
  TEMP_SKIP_TOURNAMENT_CHECKOUT,
  TOURNAMENT_MONTHLY_DEBUG_PRICE_ARS
} from "@/lib/constants";
import {
  getMercadoPagoWebhookBaseUrl,
  shouldUseMercadoPagoSandboxCheckout
} from "@/lib/env";
import { toUserMessage } from "@/lib/errors";
import {
  approveTournamentBillingPaymentForDebug,
  syncTournamentBillingPaymentFromMercadoPago
} from "@/lib/domain/tournament-billing-workflow";
import { isNextRedirectError } from "@/lib/next-redirect";
import { slugifyTournamentName } from "@/lib/org";
import { createCheckoutProPreference } from "@/lib/payments/mercadopago";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const createLeagueSchema = z.object({
  name: z.string().min(3, "El nombre de la liga debe tener al menos 3 caracteres.").max(100)
});

const startLeagueBillingSchema = z.object({
  leagueId: z.string().uuid()
});

const syncLeagueBillingSchema = z.object({
  leagueId: z.string().uuid(),
  paymentId: z.string().min(1, "paymentId invalido.")
});

const MERCADOPAGO_PREFERENCE_TTL_MS = 24 * 60 * 60 * 1000;

function buildLeagueIndexPath(params?: {
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

function buildLeagueDetailPath(
  leagueId: string,
  params?: {
    tab?: string;
    error?: string;
    success?: string;
  }
) {
  const basePath = `/admin/tournaments/${leagueId}`;
  const url = new URL(basePath, "http://localhost");
  if (params?.tab) url.searchParams.set("tab", params.tab);
  if (params?.error) url.searchParams.set("error", params.error);
  if (params?.success) url.searchParams.set("success", params.success);
  if (!params?.tab && !params?.error && !params?.success) return basePath;
  return `${basePath}?${url.searchParams.toString()}`;
}

function buildLeagueBillingPath(params?: {
  checkout?: string;
  error?: string;
  league?: string;
}) {
  const basePath = "/admin/tournaments/billing";
  const url = new URL(basePath, "http://localhost");
  if (params?.checkout) url.searchParams.set("checkout", params.checkout);
  if (params?.error) url.searchParams.set("error", params.error);
  if (params?.league) url.searchParams.set("league", params.league);
  const search = url.searchParams.toString();
  return search ? `${basePath}?${search}` : basePath;
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

function revalidateLeaguePages(leagueSlug?: string | null) {
  revalidatePath("/admin/tournaments");
  revalidatePath("/tournaments");
  revalidatePath("/admin");
  if (leagueSlug) {
    revalidatePath(`/tournaments/${leagueSlug}`);
  }
}

async function resolveUniqueLeagueSlug(params: {
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
  normalizedName: string;
}) {
  const baseSlug = slugifyTournamentName(params.normalizedName) || `liga-${Date.now()}`;
  const { data: existingRows, error: existingError } = await params.supabase
    .from("leagues")
    .select("slug")
    .ilike("slug", `${baseSlug}%`);

  if (existingError) {
    throw new Error(existingError.message);
  }

  return parseNextSlug(
    baseSlug,
    (existingRows ?? []).map((row) => String(row.slug).toLowerCase())
  );
}

async function assertUniqueLeagueName(params: {
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
  normalizedName: string;
}) {
  const { data: existingLeagueByName, error } = await params.supabase
    .from("leagues")
    .select("id")
    .ilike("name", params.normalizedName)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (existingLeagueByName) {
    throw new Error("Ya existe una liga con ese nombre.");
  }
}

export async function createLeagueAction(formData: FormData) {
  try {
    const admin = await assertAdminAction();
    const parsed = createLeagueSchema.safeParse({
      name: formData.get("name")
    });

    if (!parsed.success) {
      redirect(buildLeagueIndexPath({ error: parsed.error.issues[0]?.message ?? "Datos invalidos." }));
    }

    const supabaseAdmin = createSupabaseAdminClient();
    if (!supabaseAdmin) {
      redirect(buildLeagueIndexPath({ error: "Falta SUPABASE_SERVICE_ROLE_KEY para iniciar el pago de la liga." }));
    }

    const normalizedName = parsed.data.name.trim();
    try {
      await assertUniqueLeagueName({
        supabase: supabaseAdmin,
        normalizedName
      });
    } catch (error) {
      redirect(
        buildLeagueIndexPath({
          error: toUserMessage(error, "No se pudo validar el nombre de la liga.")
        })
      );
    }

    let requestedSlug: string;
    try {
      requestedSlug = await resolveUniqueLeagueSlug({
        supabase: supabaseAdmin,
        normalizedName
      });
    } catch (error) {
      redirect(
        buildLeagueIndexPath({
          error: toUserMessage(error, "No se pudo iniciar el alta de la liga.")
        })
      );
    }

    const externalReference = `league-create:${admin.userId}:${Date.now()}:${randomUUID().slice(0, 8)}`;

    const { data: insertedPayment, error: insertPaymentError } = await supabaseAdmin
      .from("league_billing_payments")
      .insert({
        admin_id: admin.userId,
        requested_league_name: normalizedName,
        requested_league_slug: requestedSlug,
        amount: TOURNAMENT_MONTHLY_DEBUG_PRICE_ARS,
        currency_id: ORGANIZATION_BILLING_CURRENCY,
        status: "pending",
        mp_external_reference: externalReference,
        purpose: "league_creation"
      })
      .select("id")
      .single();

    if (insertPaymentError || !insertedPayment) {
      redirect(
        buildLeagueIndexPath({
          error: toUserMessage(insertPaymentError, "No se pudo registrar el pago de la liga.")
        })
      );
    }

    if (TEMP_SKIP_TOURNAMENT_CHECKOUT) {
      const debugApproval = await approveTournamentBillingPaymentForDebug({
        supabase: supabaseAdmin,
        localPaymentId: insertedPayment.id
      });

      if (!debugApproval.updated || !debugApproval.createdLeagueId) {
        redirect(
          buildLeagueIndexPath({
            error:
              "reason" in debugApproval && debugApproval.reason
                ? debugApproval.reason
                : "No se pudo simular el pago de la liga."
          })
        );
      }

      redirect(
        buildLeagueDetailPath(debugApproval.createdLeagueId, {
          success: "Liga creada."
        })
      );
    }

    const publicBaseUrl = await resolveServerBaseUrl();
    const successPath = "/admin/tournaments?checkout=success";
    const failurePath = "/admin/tournaments?checkout=failure";
    const pendingPath = "/admin/tournaments?checkout=pending";
    const notificationPath = "/api/payments/mercadopago/webhook";

    const preference = await createCheckoutProPreference({
      title: `Crear liga (${normalizedName})`,
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
        purpose: "league_creation",
        admin_id: admin.userId,
        league_billing_payment_id: insertedPayment.id
      }
    });

    const { error: updatePaymentError } = await supabaseAdmin
      .from("league_billing_payments")
      .update({
        mp_preference_id: preference.id,
        checkout_url: preference.init_point,
        checkout_sandbox_url: preference.sandbox_init_point
      })
      .eq("id", insertedPayment.id);

    if (updatePaymentError) {
      redirect(
        buildLeagueIndexPath({
          error: toUserMessage(updatePaymentError, "No se pudo guardar la preferencia de pago.")
        })
      );
    }

    const redirectUrl = shouldUseMercadoPagoSandboxCheckout()
      ? preference.sandbox_init_point ?? preference.init_point
      : preference.init_point ?? preference.sandbox_init_point;

    if (!redirectUrl) {
      redirect(
        buildLeagueIndexPath({
          error: "Mercado Pago no devolvio una URL valida para continuar el pago."
        })
      );
    }

    redirect(redirectUrl);
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildLeagueIndexPath({ error: toUserMessage(error, "No se pudo iniciar el alta de la liga.") }));
  }
}

export async function startLeagueCheckoutAction(formData: FormData) {
  try {
    const parsed = startLeagueBillingSchema.safeParse({
      leagueId: formData.get("leagueId")
    });

    if (!parsed.success) {
      redirect(buildLeagueBillingPath({ error: parsed.error.issues[0]?.message ?? "Datos invalidos." }));
    }

    const admin = await assertLeagueMembershipAction(parsed.data.leagueId);
    const supabaseAdmin = createSupabaseAdminClient();
    if (!supabaseAdmin) {
      redirect(
        buildLeagueBillingPath({
          league: parsed.data.leagueId,
          error: "Falta SUPABASE_SERVICE_ROLE_KEY para iniciar el checkout de Mercado Pago."
        })
      );
    }

    const { data: league, error: leagueError } = await supabaseAdmin
      .from("leagues")
      .select("id, name, slug")
      .eq("id", parsed.data.leagueId)
      .maybeSingle();

    if (leagueError || !league) {
      redirect(
        buildLeagueBillingPath({
          league: parsed.data.leagueId,
          error: toUserMessage(leagueError, "No se pudo leer la liga para facturar.")
        })
      );
    }

    const externalReference = `league-subscription:${league.id}:${Date.now()}:${randomUUID().slice(0, 8)}`;
    const publicBaseUrl = await resolveServerBaseUrl();
    const successPath = buildLeagueBillingPath({ checkout: "success", league: String(league.id) });
    const failurePath = buildLeagueBillingPath({ checkout: "failure", league: String(league.id) });
    const pendingPath = buildLeagueBillingPath({ checkout: "pending", league: String(league.id) });
    const notificationPath = "/api/payments/mercadopago/webhook";

    const { data: insertedPayment, error: insertPaymentError } = await supabaseAdmin
      .from("league_billing_payments")
      .insert({
        admin_id: admin.userId,
        requested_league_name: String(league.name),
        requested_league_slug: String(league.slug),
        created_league_id: league.id,
        amount: TOURNAMENT_MONTHLY_DEBUG_PRICE_ARS,
        currency_id: ORGANIZATION_BILLING_CURRENCY,
        status: "pending",
        mp_external_reference: externalReference,
        purpose: "league_subscription"
      })
      .select("id")
      .single();

    if (insertPaymentError || !insertedPayment) {
      redirect(
        buildLeagueBillingPath({
          league: String(league.id),
          error: toUserMessage(insertPaymentError, "No se pudo registrar el intento de pago.")
        })
      );
    }

    const preference = await createCheckoutProPreference({
      title: `Plan mensual ${league.name}`,
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
        league_id: league.id,
        league_billing_payment_id: insertedPayment.id,
        purpose: "league_subscription"
      }
    });

    const { error: updatePaymentError } = await supabaseAdmin
      .from("league_billing_payments")
      .update({
        mp_preference_id: preference.id,
        checkout_url: preference.init_point,
        checkout_sandbox_url: preference.sandbox_init_point
      })
      .eq("id", insertedPayment.id);

    if (updatePaymentError) {
      redirect(
        buildLeagueBillingPath({
          league: String(league.id),
          error: toUserMessage(updatePaymentError, "No se pudo guardar la preferencia de pago.")
        })
      );
    }

    const redirectUrl = shouldUseMercadoPagoSandboxCheckout()
      ? preference.sandbox_init_point ?? preference.init_point
      : preference.init_point ?? preference.sandbox_init_point;

    if (!redirectUrl) {
      redirect(
        buildLeagueBillingPath({
          league: String(league.id),
          error: "Mercado Pago no devolvio una URL de checkout para continuar."
        })
      );
    }

    redirect(redirectUrl);
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildLeagueBillingPath({ error: toUserMessage(error, "No se pudo iniciar el pago de la liga.") }));
  }
}

export async function syncLeagueBillingPaymentAction(formData: FormData) {
  try {
    const parsed = syncLeagueBillingSchema.safeParse({
      leagueId: formData.get("leagueId"),
      paymentId: formData.get("paymentId")
    });

    if (!parsed.success) {
      redirect(buildLeagueBillingPath({ error: parsed.error.issues[0]?.message ?? "Datos invalidos." }));
    }

    await assertLeagueMembershipAction(parsed.data.leagueId);
    const supabaseAdmin = createSupabaseAdminClient();
    if (!supabaseAdmin) {
      redirect(
        buildLeagueBillingPath({
          league: parsed.data.leagueId,
          error: "Falta SUPABASE_SERVICE_ROLE_KEY para sincronizar pagos de Mercado Pago."
        })
      );
    }

    const syncResult = await syncTournamentBillingPaymentFromMercadoPago({
      supabase: supabaseAdmin,
      mercadopagoPaymentId: parsed.data.paymentId,
      expectedLeagueId: parsed.data.leagueId
    });

    if (!syncResult.updated) {
      redirect(
        buildLeagueBillingPath({
          league: parsed.data.leagueId,
          error: syncResult.reason ?? "No se pudo sincronizar el pago."
        })
      );
    }

    revalidatePath("/admin/tournaments");
    revalidatePath("/admin/tournaments/billing");
    redirect(buildLeagueBillingPath({ checkout: "sync", league: parsed.data.leagueId }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildLeagueBillingPath({ error: toUserMessage(error, "No se pudo sincronizar el pago.") }));
  }
}

export async function deleteLeagueAction(formData: FormData) {
  try {
    const admin = await assertAdminAction();
    const leagueId = String(formData.get("leagueId") ?? "").trim();

    if (!leagueId) {
      redirect(buildLeagueIndexPath({ error: "Falta la liga a borrar." }));
    }

    await assertLeagueWriteAction(leagueId);

    const supabase = await createSupabaseServerClient();
    const { data: league, error: leagueError } = await supabase
      .from("leagues")
      .select("id, name, slug, created_by")
      .eq("id", leagueId)
      .maybeSingle();

    if (leagueError || !league) {
      redirect(buildLeagueIndexPath({ error: "No se encontro la liga a borrar." }));
    }

    if (!admin.isSuperAdmin && league.created_by !== admin.userId) {
      redirect(buildLeagueIndexPath({ error: "Solo el creador de la liga puede borrarla." }));
    }

    const { count: competitionsCount, error: competitionsError } = await supabase
      .from("competitions")
      .select("id", { count: "exact", head: true })
      .eq("league_id", leagueId);

    if (competitionsError) {
      redirect(
        buildLeagueDetailPath(leagueId, {
          error: toUserMessage(competitionsError, "No se pudo validar si la liga tiene competencias.")
        })
      );
    }

    if ((competitionsCount ?? 0) > 0) {
      redirect(
        buildLeagueDetailPath(leagueId, {
          error: "Primero elimina las competencias de esta liga."
        })
      );
    }

    const { error: deleteError } = await supabase.from("leagues").delete().eq("id", leagueId);

    if (deleteError) {
      redirect(buildLeagueIndexPath({ error: toUserMessage(deleteError, "No se pudo borrar la liga.") }));
    }

    revalidateLeaguePages(league.slug);
    revalidatePath(`/admin/tournaments/${leagueId}`);
    redirect(buildLeagueIndexPath({ success: "Liga eliminada." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildLeagueIndexPath({ error: toUserMessage(error, "No se pudo borrar la liga.") }));
  }
}

export async function archiveLeagueAction(formData: FormData) {
  try {
    const leagueId = String(formData.get("leagueId") ?? "").trim();
    if (!leagueId) {
      redirect(buildLeagueIndexPath({ error: "Falta la liga a archivar." }));
    }

    await assertLeagueWriteAction(leagueId);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("leagues").update({ status: "archived" }).eq("id", leagueId);

    if (error) {
      redirect(buildLeagueIndexPath({ error: toUserMessage(error, "No se pudo archivar la liga.") }));
    }

    const slug = await getLeagueSlugById(leagueId);
    revalidateLeaguePages(slug);
    redirect(buildLeagueIndexPath({ success: "Liga archivada." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildLeagueIndexPath({ error: toUserMessage(error, "No se pudo archivar la liga.") }));
  }
}

export const createTournamentAction = createLeagueAction;
export const deleteTournamentAction = deleteLeagueAction;
export const archiveTournamentAction = archiveLeagueAction;
