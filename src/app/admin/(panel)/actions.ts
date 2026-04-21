"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "node:crypto";
import { z } from "zod";

import {
  assertAdminAction,
  assertCanCreateOrganization,
  assertOrganizationAdminAction,
  assertOrganizationMembershipAction,
  getAdminOrganizationCreationAccess,
  getOrganizationQueryKeyById
} from "@/lib/auth/admin";
import {
  ORGANIZATION_BILLING_CURRENCY
} from "@/lib/constants";
import {
  cleanupStalePendingOrganizationBillingPayments,
  syncOrganizationBillingPaymentFromMercadoPago
} from "@/lib/domain/billing-workflow";
import {
  deleteOrganizationDeep
} from "@/lib/domain/organization-workflow";
import {
  getPlayerPhotosBucket,
  getMercadoPagoWebhookBaseUrl,
  getSupabaseDbSchema,
  shouldUseMercadoPagoSandboxCheckout
} from "@/lib/env";
import { isNextRedirectError } from "@/lib/next-redirect";
import { normalizeEmail, slugifyOrganizationName, withOrgQuery } from "@/lib/org";
import { toUserMessage } from "@/lib/errors";
import { createCheckoutProPreference } from "@/lib/payments/mercadopago";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const createOrganizationSchema = z.object({
  name: z
    .string()
    .min(3, "El nombre de la organizacion debe tener al menos 3 caracteres.")
    .max(80, "El nombre de la organizacion es demasiado largo.")
});

const inviteSchema = z.object({
  organizationId: z.string().uuid(),
  email: z.string().email("Ingresa un email valido.")
});

const revokeInviteSchema = z.object({
  organizationId: z.string().uuid(),
  inviteId: z.string().uuid()
});

const removeAdminSchema = z.object({
  organizationId: z.string().uuid(),
  adminId: z.string().uuid()
});

const deleteOrganizationSchema = z.object({
  organizationId: z.string().uuid()
});

const startCheckoutSchema = z.object({
  organizationId: z.string().uuid()
});

const startOrganizationCreationCheckoutSchema = z.object({
  organizationId: z.string().uuid(),
  name: z
    .string()
    .min(3, "El nombre de la organizacion debe tener al menos 3 caracteres.")
    .max(80, "El nombre de la organizacion es demasiado largo.")
});

const syncCheckoutPaymentSchema = z.object({
  organizationId: z.string().uuid(),
  paymentId: z.string().min(1, "paymentId invalido.")
});

const MERCADOPAGO_TEST_CHARGE_ARS = 100;
const MERCADOPAGO_PREFERENCE_TTL_MS = 24 * 60 * 60 * 1000;

function buildAdminPath(organizationKey?: string, error?: string) {
  const basePath = withOrgQuery("/admin", organizationKey ?? null);
  if (!error) return basePath;
  const separator = basePath.includes("?") ? "&" : "?";
  return `${basePath}${separator}error=${encodeURIComponent(error)}`;
}

function buildBillingPath(organizationKey?: string, error?: string) {
  const basePath = withOrgQuery("/admin/billing", organizationKey ?? null);
  if (!error) return basePath;
  const separator = basePath.includes("?") ? "&" : "?";
  return `${basePath}${separator}error=${encodeURIComponent(error)}`;
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

async function organizationAlreadyHasAdminWithEmail(params: {
  organizationId: string;
  normalizedEmail: string;
}) {
  const supabaseAdmin = createSupabaseAdminClient();
  if (!supabaseAdmin) return false;

  const { data: memberships, error: membershipsError } = await supabaseAdmin
    .from("organization_admins")
    .select("admin_id")
    .eq("organization_id", params.organizationId);

  if (membershipsError) {
    throw new Error(membershipsError.message);
  }

  const adminIds = Array.from(new Set((memberships ?? []).map((row) => row.admin_id)));
  if (!adminIds.length) return false;

  const { data: authUsers, error: authUsersError } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000
  });

  if (authUsersError) {
    throw new Error(authUsersError.message);
  }

  const currentAdminEmails = new Map(
    (authUsers?.users ?? [])
      .filter((user) => adminIds.includes(user.id))
      .map((user) => [user.id, normalizeEmail(user.email ?? "")])
  );

  return adminIds.some((adminId) => currentAdminEmails.get(adminId) === params.normalizedEmail);
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

export async function createOrganizationAction(formData: FormData) {
  try {
    const admin = await assertAdminAction();
    await assertCanCreateOrganization(admin);
    const parsed = createOrganizationSchema.safeParse({
      name: formData.get("name")
    });

    if (!parsed.success) {
      redirect(buildAdminPath(undefined, parsed.error.issues[0]?.message ?? "Datos invalidos."));
    }

    const supabase = await createSupabaseServerClient();

    const baseSlug = slugifyOrganizationName(parsed.data.name) || `organizacion-${Date.now()}`;
    const { data: existingSlugsRows, error: existingSlugsError } = await supabase
      .from("organizations")
      .select("slug")
      .ilike("slug", `${baseSlug}%`);

    if (existingSlugsError) {
      redirect(buildAdminPath(undefined, toUserMessage(existingSlugsError, "No se pudo crear la organizacion.")));
    }

    const existingSlugs = (existingSlugsRows ?? []).map((row) => row.slug.toLowerCase());
    const slug = parseNextSlug(baseSlug, existingSlugs);

    const { data: organization, error: organizationError } = await supabase
      .from("organizations")
      .insert({
        name: parsed.data.name.trim(),
        slug,
        created_by: admin.userId,
        is_public: true
      })
      .select("id")
      .single();

    if (organizationError || !organization) {
      redirect(buildAdminPath(undefined, toUserMessage(organizationError, "No se pudo crear la organizacion.")));
    }

    const { error: membershipError } = await supabase.from("organization_admins").insert({
      organization_id: organization.id,
      admin_id: admin.userId,
      created_by: admin.userId
    });

    if (membershipError && membershipError.code !== "23505") {
      redirect(buildAdminPath(undefined, toUserMessage(membershipError, "No se pudo asociar el admin a la organizacion.")));
    }

    revalidatePath("/admin");
    revalidatePath("/");
    revalidatePath("/ranking");
    revalidatePath("/players");
    revalidatePath("/matches");
    revalidatePath("/upcoming");
    redirect(withOrgQuery("/admin", slug));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildAdminPath(undefined, toUserMessage(error, "No se pudo crear la organizacion.")));
  }
}

export async function startOrganizationCreationCheckoutAction(formData: FormData) {
  try {
    const parsed = startOrganizationCreationCheckoutSchema.safeParse({
      organizationId: formData.get("organizationId"),
      name: formData.get("name")
    });

    if (!parsed.success) {
      redirect(buildAdminPath(undefined, parsed.error.issues[0]?.message ?? "Datos invalidos."));
    }

    const admin = await assertOrganizationMembershipAction(parsed.data.organizationId);
    const creationAccess = await getAdminOrganizationCreationAccess(admin);
    const organizationQueryKey = await getOrganizationQueryKeyById(parsed.data.organizationId);

    if (creationAccess.canCreateOrganization) {
      redirect(
        buildAdminPath(
          organizationQueryKey,
          "Tu cuenta ya puede crear una nueva organizacion sin necesidad de pagar."
        )
      );
    }

    const supabaseAdmin = createSupabaseAdminClient();
    if (!supabaseAdmin) {
      redirect(
        buildAdminPath(
          organizationQueryKey,
          "Falta SUPABASE_SERVICE_ROLE_KEY para iniciar el pago de nueva organizacion."
        )
      );
    }

    const normalizedOrgName = parsed.data.name.trim();
    const baseSlug = slugifyOrganizationName(normalizedOrgName) || `organizacion-${Date.now()}`;
    const { data: existingSlugsRows, error: existingSlugsError } = await supabaseAdmin
      .from("organizations")
      .select("slug")
      .ilike("slug", `${baseSlug}%`);

    if (existingSlugsError) {
      redirect(buildAdminPath(organizationQueryKey, toUserMessage(existingSlugsError, "No se pudo iniciar el pago.")));
    }

    const existingSlugs = (existingSlugsRows ?? []).map((row) => row.slug.toLowerCase());
    const requestedSlug = parseNextSlug(baseSlug, existingSlugs);

    const externalReference = `${parsed.data.organizationId}:${Date.now()}:${crypto
      .randomUUID()
      .slice(0, 8)}`;
    const publicBaseUrl = await resolveServerBaseUrl();
    const successPath = withOrgQuery(
      "/admin?checkout=success&flow=create-org",
      organizationQueryKey
    );
    const failurePath = withOrgQuery(
      "/admin?checkout=failure&flow=create-org",
      organizationQueryKey
    );
    const pendingPath = withOrgQuery(
      "/admin?checkout=pending&flow=create-org",
      organizationQueryKey
    );
    const notificationPath = "/api/payments/mercadopago/webhook";

    await cleanupStalePendingOrganizationBillingPayments({
      supabase: supabaseAdmin,
      organizationId: parsed.data.organizationId
    });

    const { data: insertedPayment, error: insertPaymentError } = await supabaseAdmin
      .from("organization_billing_payments")
      .insert({
        organization_id: parsed.data.organizationId,
        created_by: admin.userId,
        amount: MERCADOPAGO_TEST_CHARGE_ARS,
        currency_id: ORGANIZATION_BILLING_CURRENCY,
        status: "pending",
        mp_external_reference: externalReference,
        purpose: "organization_creation",
        requested_organization_name: normalizedOrgName,
        requested_organization_slug: requestedSlug,
        requested_by_admin_id: admin.userId
      })
      .select("id")
      .single();

    if (insertPaymentError || !insertedPayment) {
      redirect(
        buildAdminPath(
          organizationQueryKey,
          toUserMessage(insertPaymentError, "No se pudo registrar el pago para crear la organizacion.")
        )
      );
    }

    const preference = await createCheckoutProPreference({
      title: `Crear nueva organizacion (${normalizedOrgName})`,
      unitPrice: MERCADOPAGO_TEST_CHARGE_ARS,
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
        organization_id: parsed.data.organizationId,
        billing_payment_id: insertedPayment.id,
        purpose: "organization_creation"
      }
    });

    const { error: updatePaymentError } = await supabaseAdmin
      .from("organization_billing_payments")
      .update({
        mp_preference_id: preference.id,
        checkout_url: preference.init_point,
        checkout_sandbox_url: preference.sandbox_init_point
      })
      .eq("id", insertedPayment.id);

    if (updatePaymentError) {
      redirect(buildAdminPath(organizationQueryKey, toUserMessage(updatePaymentError, "No se pudo guardar la preferencia de pago.")));
    }

    const redirectUrl = shouldUseMercadoPagoSandboxCheckout()
      ? preference.sandbox_init_point ?? preference.init_point
      : preference.init_point ?? preference.sandbox_init_point;

    if (!redirectUrl) {
      redirect(
        buildAdminPath(
          organizationQueryKey,
          "Mercado Pago no devolvio una URL valida para continuar el pago."
        )
      );
    }

    redirect(redirectUrl);
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildAdminPath(undefined, toUserMessage(error, "No se pudo iniciar el pago para crear la nueva organizacion.")));
  }
}

export async function startOrganizationCheckoutProAction(formData: FormData) {
  try {
    const parsed = startCheckoutSchema.safeParse({
      organizationId: formData.get("organizationId")
    });

    if (!parsed.success) {
      redirect(buildBillingPath(undefined, parsed.error.issues[0]?.message ?? "Datos invalidos."));
    }

    const admin = await assertOrganizationMembershipAction(parsed.data.organizationId);
    const organizationQueryKey = await getOrganizationQueryKeyById(parsed.data.organizationId);
    const supabaseAdmin = createSupabaseAdminClient();
    if (!supabaseAdmin) {
      redirect(
        buildBillingPath(
          organizationQueryKey,
          "Falta SUPABASE_SERVICE_ROLE_KEY para iniciar el checkout de Mercado Pago."
        )
      );
    }

    const { data: organization, error: organizationError } = await supabaseAdmin
      .from("organizations")
      .select("id, name")
      .eq("id", parsed.data.organizationId)
      .maybeSingle();

    if (organizationError || !organization) {
      redirect(
        buildBillingPath(
          organizationQueryKey,
          toUserMessage(organizationError, "No se pudo leer la organizacion para facturar.")
        )
      );
    }

    const externalReference = `${organization.id}:${Date.now()}:${crypto
      .randomUUID()
      .slice(0, 8)}`;
    const publicBaseUrl = await resolveServerBaseUrl();
    const successPath = withOrgQuery("/admin/billing?checkout=success", organizationQueryKey);
    const failurePath = withOrgQuery("/admin/billing?checkout=failure", organizationQueryKey);
    const pendingPath = withOrgQuery("/admin/billing?checkout=pending", organizationQueryKey);
    const notificationPath = "/api/payments/mercadopago/webhook";

    await cleanupStalePendingOrganizationBillingPayments({
      supabase: supabaseAdmin,
      organizationId: organization.id
    });

    const { data: insertedPayment, error: insertPaymentError } = await supabaseAdmin
      .from("organization_billing_payments")
      .insert({
        organization_id: organization.id,
        created_by: admin.userId,
        amount: MERCADOPAGO_TEST_CHARGE_ARS,
        currency_id: ORGANIZATION_BILLING_CURRENCY,
        status: "pending",
        mp_external_reference: externalReference,
        purpose: "organization_subscription"
      })
      .select("id")
      .single();

    if (insertPaymentError || !insertedPayment) {
      redirect(
        buildBillingPath(
          organizationQueryKey,
          toUserMessage(insertPaymentError, "No se pudo registrar el intento de pago.")
        )
      );
    }

    const preference = await createCheckoutProPreference({
      title: `Plan mensual ${organization.name}`,
      unitPrice: MERCADOPAGO_TEST_CHARGE_ARS,
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
        organization_id: organization.id,
        billing_payment_id: insertedPayment.id
      }
    });

    const { error: updatePaymentError } = await supabaseAdmin
      .from("organization_billing_payments")
      .update({
        mp_preference_id: preference.id,
        checkout_url: preference.init_point,
        checkout_sandbox_url: preference.sandbox_init_point
      })
      .eq("id", insertedPayment.id);

    if (updatePaymentError) {
      redirect(buildBillingPath(organizationQueryKey, toUserMessage(updatePaymentError, "No se pudo guardar la preferencia de pago.")));
    }

    const redirectUrl = shouldUseMercadoPagoSandboxCheckout()
      ? preference.sandbox_init_point ?? preference.init_point
      : preference.init_point ?? preference.sandbox_init_point;

    if (!redirectUrl) {
      redirect(
        buildBillingPath(
          organizationQueryKey,
          "Mercado Pago no devolvio una URL de checkout para continuar."
        )
      );
    }

    redirect(redirectUrl);
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildBillingPath(undefined, toUserMessage(error, "No se pudo iniciar el pago en Mercado Pago.")));
  }
}

export async function syncOrganizationCheckoutPaymentAction(formData: FormData) {
  try {
    const parsed = syncCheckoutPaymentSchema.safeParse({
      organizationId: formData.get("organizationId"),
      paymentId: formData.get("paymentId")
    });

    if (!parsed.success) {
      redirect(buildBillingPath(undefined, parsed.error.issues[0]?.message ?? "Datos invalidos."));
    }

    await assertOrganizationMembershipAction(parsed.data.organizationId);
    const organizationQueryKey = await getOrganizationQueryKeyById(parsed.data.organizationId);
    const supabaseAdmin = createSupabaseAdminClient();
    if (!supabaseAdmin) {
      redirect(
        buildBillingPath(
          organizationQueryKey,
          "Falta SUPABASE_SERVICE_ROLE_KEY para sincronizar pagos de Mercado Pago."
        )
      );
    }

    await syncOrganizationBillingPaymentFromMercadoPago({
      supabase: supabaseAdmin,
      mercadopagoPaymentId: parsed.data.paymentId,
      expectedOrganizationId: parsed.data.organizationId
    });

    revalidatePath("/admin");
    revalidatePath("/admin/billing");
    redirect(withOrgQuery("/admin/billing?checkout=sync", organizationQueryKey));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildBillingPath(undefined, toUserMessage(error, "No se pudo sincronizar el pago.")));
  }
}

export async function inviteOrganizationAdminAction(formData: FormData) {
  try {
    const parsed = inviteSchema.safeParse({
      organizationId: formData.get("organizationId"),
      email: formData.get("email")
    });

    if (!parsed.success) {
      redirect(buildAdminPath(undefined, parsed.error.issues[0]?.message ?? "Datos invalidos."));
    }

    const admin = await assertOrganizationAdminAction(parsed.data.organizationId);
    const organizationQueryKey = await getOrganizationQueryKeyById(parsed.data.organizationId);
    const normalizedEmail = normalizeEmail(parsed.data.email);

    if (normalizedEmail === admin.email) {
      redirect(buildAdminPath(organizationQueryKey, "Tu usuario ya administra esta organizacion."));
    }

    if (
      await organizationAlreadyHasAdminWithEmail({
        organizationId: parsed.data.organizationId,
        normalizedEmail
      })
    ) {
      redirect(buildAdminPath(organizationQueryKey, "Ese email ya administra esta organizacion."));
    }

    const supabase = await createSupabaseServerClient();
    const [{ count: currentAdmins, error: adminCountError }, { count: pendingInvites, error: inviteCountError }] =
      await Promise.all([
        supabase
          .from("organization_admins")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", parsed.data.organizationId),
        supabase
          .from("organization_invites")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", parsed.data.organizationId)
          .eq("status", "pending")
      ]);

    if (adminCountError) {
      redirect(buildAdminPath(organizationQueryKey, toUserMessage(adminCountError, "No se pudo verificar los admins actuales.")));
    }
    if (inviteCountError) {
      redirect(buildAdminPath(organizationQueryKey, toUserMessage(inviteCountError, "No se pudo verificar invitaciones pendientes.")));
    }

    const slotsUsed = (currentAdmins ?? 0) + (pendingInvites ?? 0);
    if (slotsUsed >= 4) {
      redirect(buildAdminPath(organizationQueryKey, "Esta organizacion ya alcanzo el maximo de 4 administradores."));
    }

    const { error: inviteError } = await supabase.from("organization_invites").insert({
      organization_id: parsed.data.organizationId,
      email: normalizedEmail,
      invited_by: admin.userId,
      status: "pending"
    });

    if (inviteError) {
      const alreadyInvited = inviteError.code === "23505";
      redirect(
        buildAdminPath(
          organizationQueryKey,
          alreadyInvited
            ? "Ese email ya tiene una invitacion pendiente."
            : toUserMessage(inviteError, "No se pudo generar la invitacion.")
        )
      );
    }

    revalidatePath("/admin");
    redirect(withOrgQuery("/admin", organizationQueryKey));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildAdminPath(undefined, toUserMessage(error, "No se pudo generar la invitacion.")));
  }
}

export async function revokeOrganizationInviteAction(formData: FormData) {
  try {
    const parsed = revokeInviteSchema.safeParse({
      organizationId: formData.get("organizationId"),
      inviteId: formData.get("inviteId")
    });

    if (!parsed.success) {
      redirect(buildAdminPath(undefined, parsed.error.issues[0]?.message ?? "Datos invalidos."));
    }

    await assertOrganizationAdminAction(parsed.data.organizationId);
    const organizationQueryKey = await getOrganizationQueryKeyById(parsed.data.organizationId);
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from("organization_invites")
      .delete()
      .eq("id", parsed.data.inviteId)
      .eq("organization_id", parsed.data.organizationId);

    if (error) {
      redirect(buildAdminPath(organizationQueryKey, toUserMessage(error, "No se pudo cancelar la invitacion.")));
    }

    revalidatePath("/admin");
    redirect(withOrgQuery("/admin", organizationQueryKey));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildAdminPath(undefined, toUserMessage(error, "No se pudo cancelar la invitacion.")));
  }
}

export async function removeOrganizationAdminAction(formData: FormData) {
  try {
    const parsed = removeAdminSchema.safeParse({
      organizationId: formData.get("organizationId"),
      adminId: formData.get("adminId")
    });

    if (!parsed.success) {
      redirect(buildAdminPath(undefined, parsed.error.issues[0]?.message ?? "Datos invalidos."));
    }

    const actingAdmin = await assertOrganizationAdminAction(parsed.data.organizationId);
    const organizationQueryKey = await getOrganizationQueryKeyById(parsed.data.organizationId);
    const supabase = await createSupabaseServerClient();

    if (actingAdmin.userId === parsed.data.adminId) {
      redirect(buildAdminPath(organizationQueryKey, "No puedes quitarte a ti mismo como admin de esta organizacion."));
    }

    const { count: adminsCount, error: adminsCountError } = await supabase
      .from("organization_admins")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", parsed.data.organizationId);

    if (adminsCountError) {
      redirect(buildAdminPath(organizationQueryKey, toUserMessage(adminsCountError, "No se pudo contar los admins actuales.")));
    }

    if ((adminsCount ?? 0) <= 1) {
      redirect(buildAdminPath(organizationQueryKey, "La organizacion debe mantener al menos 1 admin activo."));
    }

    const { error: deleteError } = await supabase
      .from("organization_admins")
      .delete()
      .eq("organization_id", parsed.data.organizationId)
      .eq("admin_id", parsed.data.adminId);

    if (deleteError) {
      redirect(buildAdminPath(organizationQueryKey, toUserMessage(deleteError, "No se pudo quitar al administrador.")));
    }

    revalidatePath("/admin");
    redirect(withOrgQuery("/admin", organizationQueryKey));
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildAdminPath(undefined, toUserMessage(error, "No se pudo quitar al administrador.")));
  }
}

export async function deleteOrganizationAction(formData: FormData) {
  try {
    const admin = await assertAdminAction();
    if (!admin.isSuperAdmin) {
      redirect(buildAdminPath(undefined, "Solo el super admin puede borrar organizaciones."));
    }

    const parsed = deleteOrganizationSchema.safeParse({
      organizationId: formData.get("organizationId")
    });

    if (!parsed.success) {
      redirect(buildAdminPath(undefined, parsed.error.issues[0]?.message ?? "Datos invalidos."));
    }

    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      redirect(buildAdminPath(undefined, "Falta configurar el cliente admin para borrar organizaciones."));
    }

    const { data: organization, error: organizationError } = await supabase
      .from("organizations")
      .select("id")
      .eq("id", parsed.data.organizationId)
      .maybeSingle();

    if (organizationError) {
      redirect(buildAdminPath(undefined, toUserMessage(organizationError, "No se pudo leer la organizacion.")));
    }

    if (!organization) {
      redirect(buildAdminPath(undefined, "La organizacion ya no existe."));
    }

    await deleteOrganizationDeep({
      supabase,
      organizationId: parsed.data.organizationId,
      playerPhotosBucket: getPlayerPhotosBucket(),
      schemaName: getSupabaseDbSchema()
    });

    revalidatePath("/admin");
    revalidatePath("/");
    revalidatePath("/ranking");
    revalidatePath("/players");
    revalidatePath("/matches");
    revalidatePath("/upcoming");
    redirect("/admin");
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    redirect(buildAdminPath(undefined, toUserMessage(error, "No se pudo borrar la organizacion.")));
  }
}
