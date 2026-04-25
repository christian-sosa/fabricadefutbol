"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { assertAdminAction } from "@/lib/auth/admin";
import { assertTournamentMembershipAction, getTournamentSlugById } from "@/lib/auth/tournaments";
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
import { approveTournamentBillingPaymentForDebug } from "@/lib/domain/tournament-billing-workflow";
import { isNextRedirectError } from "@/lib/next-redirect";
import { slugifyTournamentName } from "@/lib/org";
import { createCheckoutProPreference } from "@/lib/payments/mercadopago";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const optionalUuidField = z.preprocess((value) => {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length ? normalized : undefined;
}, z.string().uuid().optional());

const createTournamentSchema = z.object({
  name: z.string().min(3, "El nombre del torneo debe tener al menos 3 caracteres.").max(100),
  parentTournamentId: optionalUuidField,
  returnToTournamentId: optionalUuidField
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

function buildTournamentDetailPath(
  tournamentId: string,
  params?: {
    error?: string;
    success?: string;
  }
) {
  const basePath = `/admin/tournaments/${tournamentId}`;
  const url = new URL(basePath, "http://localhost");
  if (params?.error) url.searchParams.set("error", params.error);
  if (params?.success) url.searchParams.set("success", params.success);
  if (!params?.error && !params?.success) return basePath;
  return `${basePath}?${url.searchParams.toString()}`;
}

function buildCreateTournamentErrorPath(message: string, returnToTournamentId?: string | null) {
  if (returnToTournamentId) {
    return buildTournamentDetailPath(returnToTournamentId, { error: message });
  }
  return buildTournamentIndexPath({ error: message });
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
  revalidatePath("/admin");
  if (tournamentSlug) {
    revalidatePath(`/tournaments/${tournamentSlug}`);
  }
}

async function resolveTournamentRootId(tournamentId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tournaments")
    .select("id, name, parent_tournament_id")
    .eq("id", tournamentId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("No se encontro el torneo base para crear el subtorneo.");
  }

  return {
    id: data.parent_tournament_id ?? data.id,
    name: data.parent_tournament_id ? null : data.name
  };
}

async function resolveUniqueTournamentSlug(params: {
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
  normalizedName: string;
}) {
  const baseSlug = slugifyTournamentName(params.normalizedName) || `torneo-${Date.now()}`;
  const { data: existingRows, error: existingError } = await params.supabase
    .from("tournaments")
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

async function assertUniqueTournamentName(params: {
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
  normalizedName: string;
}) {
  const { data: existingTournamentByName, error } = await params.supabase
    .from("tournaments")
    .select("id")
    .ilike("name", params.normalizedName)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (existingTournamentByName) {
    throw new Error("Ya existe un torneo con ese nombre.");
  }
}

async function createDirectTournament(params: {
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
  adminId: string;
  normalizedName: string;
  requestedSlug: string;
  parentTournamentId?: string;
}) {
  const seasonLabel = String(new Date().getFullYear());
  const { data: insertedTournament, error } = await params.supabase
    .from("tournaments")
    .insert({
      name: params.normalizedName,
      slug: params.requestedSlug,
      season_label: seasonLabel,
      description: null,
      is_public: true,
      status: "draft",
      created_by: params.adminId,
      parent_tournament_id: params.parentTournamentId ?? null
    })
    .select("id, slug")
    .single();

  if (error || !insertedTournament) {
    throw new Error(error?.message ?? "No se pudo crear el torneo.");
  }

  return {
    id: String(insertedTournament.id),
    slug: String(insertedTournament.slug)
  };
}

export async function createTournamentAction(formData: FormData) {
  try {
    const admin = await assertAdminAction();
    const rawReturnToTournamentId = String(formData.get("returnToTournamentId") ?? "").trim() || null;
    const parsed = createTournamentSchema.safeParse({
      name: formData.get("name"),
      parentTournamentId: formData.get("parentTournamentId"),
      returnToTournamentId: formData.get("returnToTournamentId")
    });

    if (!parsed.success) {
      redirect(buildCreateTournamentErrorPath(parsed.error.issues[0]?.message ?? "Datos invalidos.", rawReturnToTournamentId));
    }

    const supabaseAdmin = createSupabaseAdminClient();
    if (!supabaseAdmin) {
      redirect(
        buildCreateTournamentErrorPath(
          "Falta SUPABASE_SERVICE_ROLE_KEY para iniciar el pago del torneo.",
          parsed.data.returnToTournamentId
        )
      );
    }

    const normalizedName = parsed.data.name.trim();
    try {
      await assertUniqueTournamentName({
        supabase: supabaseAdmin,
        normalizedName
      });
    } catch (error) {
      redirect(
        buildCreateTournamentErrorPath(
          toUserMessage(error, "No se pudo validar el nombre del torneo."),
          parsed.data.returnToTournamentId
        )
      );
    }

    let requestedSlug: string;
    try {
      requestedSlug = await resolveUniqueTournamentSlug({
        supabase: supabaseAdmin,
        normalizedName
      });
    } catch (error) {
      redirect(
        buildCreateTournamentErrorPath(
          toUserMessage(error, "No se pudo iniciar el alta del torneo."),
          parsed.data.returnToTournamentId
        )
      );
    }

    if (parsed.data.parentTournamentId) {
      await assertTournamentMembershipAction(parsed.data.parentTournamentId);
      const resolvedRoot = await resolveTournamentRootId(parsed.data.parentTournamentId);

      const createdSubtournament = await createDirectTournament({
        supabase: supabaseAdmin,
        adminId: admin.userId,
        normalizedName,
        requestedSlug,
        parentTournamentId: resolvedRoot.id
      });

      revalidateTournamentPages(createdSubtournament.slug);
      revalidatePath(`/admin/tournaments/${createdSubtournament.id}`);
      revalidatePath(`/admin/tournaments/${resolvedRoot.id}`);

      const rootTournamentSlug = await getTournamentSlugById(resolvedRoot.id);
      revalidateTournamentPages(rootTournamentSlug);

      redirect(
        buildTournamentDetailPath(createdSubtournament.id, {
          success: "Subtorneo creado."
        })
      );
    }

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
        buildCreateTournamentErrorPath(
          toUserMessage(insertPaymentError, "No se pudo registrar el pago del torneo."),
          parsed.data.returnToTournamentId
        )
      );
    }

    if (TEMP_SKIP_TOURNAMENT_CHECKOUT) {
      const debugApproval = await approveTournamentBillingPaymentForDebug({
        supabase: supabaseAdmin,
        localPaymentId: insertedPayment.id
      });

      if (!debugApproval.updated || !debugApproval.createdTournamentId) {
          redirect(
          buildCreateTournamentErrorPath(
            "reason" in debugApproval && debugApproval.reason
              ? debugApproval.reason
              : "No se pudo simular el pago del torneo.",
            parsed.data.returnToTournamentId
          )
        );
      }

      redirect(
        buildTournamentDetailPath(debugApproval.createdTournamentId, {
          success: "Torneo creado."
        })
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
        buildCreateTournamentErrorPath(
          toUserMessage(updatePaymentError, "No se pudo guardar la preferencia de pago."),
          parsed.data.returnToTournamentId
        )
      );
    }

    const redirectUrl = shouldUseMercadoPagoSandboxCheckout()
      ? preference.sandbox_init_point ?? preference.init_point
      : preference.init_point ?? preference.sandbox_init_point;

    if (!redirectUrl) {
      redirect(
        buildCreateTournamentErrorPath(
          "Mercado Pago no devolvio una URL valida para continuar el pago.",
          parsed.data.returnToTournamentId
        )
      );
    }

    redirect(redirectUrl);
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(
      buildCreateTournamentErrorPath(
        toUserMessage(error, "No se pudo iniciar el pago del torneo."),
        String(formData.get("returnToTournamentId") ?? "").trim() || null
      )
    );
  }
}

export async function deleteTournamentAction(formData: FormData) {
  try {
    const admin = await assertAdminAction();
    const tournamentId = String(formData.get("tournamentId") ?? "").trim();
    const returnToTournamentId = String(formData.get("returnToTournamentId") ?? "").trim() || null;

    if (!tournamentId) {
      redirect(buildTournamentIndexPath({ error: "Falta el torneo a borrar." }));
    }

    await assertTournamentMembershipAction(tournamentId);

    const supabase = await createSupabaseServerClient();
    const { data: tournament, error: tournamentError } = await supabase
      .from("tournaments")
      .select("id, name, slug, created_by, parent_tournament_id")
      .eq("id", tournamentId)
      .maybeSingle();

    if (tournamentError || !tournament) {
      redirect(buildTournamentIndexPath({ error: "No se encontro el torneo a borrar." }));
    }

    if (!admin.isSuperAdmin && tournament.created_by !== admin.userId) {
      const targetPath = returnToTournamentId
        ? buildTournamentDetailPath(returnToTournamentId, {
            error: "Solo el creador del torneo puede borrarlo."
          })
        : buildTournamentIndexPath({ error: "Solo el creador del torneo puede borrarlo." });
      redirect(targetPath);
    }

    const { count: childrenCount, error: childrenError } = await supabase
      .from("tournaments")
      .select("id", { count: "exact", head: true })
      .eq("parent_tournament_id", tournamentId);

    if (childrenError) {
      redirect(
        buildTournamentDetailPath(tournamentId, {
          error: toUserMessage(childrenError, "No se pudo validar si el torneo tiene subtorneos.")
        })
      );
    }

    if ((childrenCount ?? 0) > 0) {
      redirect(
        buildTournamentDetailPath(tournamentId, {
          error: "Primero borra o mueve los subtorneos que cuelgan de este torneo."
        })
      );
    }

    const { error: deleteError } = await supabase.from("tournaments").delete().eq("id", tournamentId);

    if (deleteError) {
      const targetPath = returnToTournamentId
        ? buildTournamentDetailPath(
            returnToTournamentId,
            { error: toUserMessage(deleteError, "No se pudo borrar el torneo.") }
          )
        : buildTournamentIndexPath({ error: toUserMessage(deleteError, "No se pudo borrar el torneo.") });
      redirect(targetPath);
    }

    revalidateTournamentPages(tournament.slug);
    revalidatePath(`/admin/tournaments/${tournamentId}`);

    const parentTournamentId = returnToTournamentId ?? tournament.parent_tournament_id ?? null;
    if (parentTournamentId) {
      revalidatePath(`/admin/tournaments/${parentTournamentId}`);
      const parentSlug = await getTournamentSlugById(parentTournamentId);
      revalidateTournamentPages(parentSlug);
      redirect(
        buildTournamentDetailPath(parentTournamentId, {
          success: "Subtorneo eliminado."
        })
      );
    }

    redirect(buildTournamentIndexPath({ success: "Torneo eliminado." }));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildTournamentIndexPath({ error: toUserMessage(error, "No se pudo borrar el torneo.") }));
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
