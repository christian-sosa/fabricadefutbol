import { redirect } from "next/navigation";

import { FREE_TRIAL_DAYS, SUPER_ADMIN_EMAIL } from "@/lib/constants";
import {
  addDaysToIsoDate,
  getOrganizationTrialEndsAt,
  hasActiveOrganizationSubscription,
  isIsoDateExpired,
  toShortDate
} from "@/lib/domain/billing";
import { normalizeEmail } from "@/lib/org";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AdminSession = {
  userId: string;
  email: string;
  displayName: string;
  isSuperAdmin: boolean;
};

export type AdminOrganization = {
  id: string;
  name: string;
  slug: string;
  is_public: boolean;
  created_at: string;
};

type FreeTrialStatus = {
  hasCreatedOrganization: boolean;
  firstOrganizationCreatedAt: string | null;
  trialEndsAt: string | null;
  trialExpired: boolean;
};

export type OrganizationWriteAccess = {
  canWrite: boolean;
  reason: string | null;
  organizationTrialEndsAt: string | null;
  organizationTrialExpired: boolean;
  adminTrialEndsAt: string | null;
  adminTrialExpired: boolean;
  subscriptionStatus: string | null;
  subscriptionCurrentPeriodEnd: string | null;
  subscriptionActive: boolean;
};

let cachedSuperAdminUserId: string | null | undefined;

function findOrganizationByKey(organizations: AdminOrganization[], organizationKey?: string | null) {
  if (!organizationKey) return null;
  const normalizedKey = organizationKey.trim().toLowerCase();
  if (!normalizedKey) return null;

  return (
    organizations.find(
      (organization) => organization.slug.toLowerCase() === normalizedKey || organization.id === organizationKey
    ) ?? null
  );
}

function deriveDisplayName(email: string, metadata?: Record<string, unknown>) {
  const fromMetadata =
    typeof metadata?.display_name === "string"
      ? metadata.display_name
      : typeof metadata?.name === "string"
        ? metadata.name
        : null;

  if (fromMetadata && fromMetadata.trim().length) {
    return fromMetadata.trim().slice(0, 80);
  }

  const localPart = email.split("@")[0] ?? "admin";
  return localPart.replace(/[._-]+/g, " ").trim().slice(0, 80) || "admin";
}

async function ensureAdminProfile(params: {
  userId: string;
  email: string;
  metadata?: Record<string, unknown>;
}) {
  const { userId, email, metadata } = params;
  const supabase = await createSupabaseServerClient();

  const { data: existing, error: existingError } = await supabase
    .from("admins")
    .select("id, display_name")
    .eq("id", userId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing) {
    return existing;
  }

  const fallbackName = deriveDisplayName(email, metadata);
  const { error: insertError } = await supabase.from("admins").insert({
    id: userId,
    display_name: fallbackName
  });

  if (insertError && insertError.code !== "23505") {
    throw new Error(insertError.message);
  }

  const { data: inserted, error: insertedError } = await supabase
    .from("admins")
    .select("id, display_name")
    .eq("id", userId)
    .maybeSingle();

  if (insertedError || !inserted) {
    throw new Error(insertedError?.message ?? "No se pudo crear perfil de administrador.");
  }

  return inserted;
}

async function autoAcceptOrganizationInvites(adminId: string, email: string) {
  const normalizedEmail = normalizeEmail(email);
  const supabase = await createSupabaseServerClient();

  const { data: pendingInvites, error: pendingInvitesError } = await supabase
    .from("organization_invites")
    .select("id, organization_id")
    .eq("status", "pending")
    .eq("email", normalizedEmail);

  if (pendingInvitesError || !pendingInvites?.length) {
    return;
  }

  for (const invite of pendingInvites) {
    const { error: addMembershipError } = await supabase
      .from("organization_admins")
      .insert({
        organization_id: invite.organization_id,
        admin_id: adminId,
        created_by: adminId
      });

    if (addMembershipError && addMembershipError.code !== "23505") {
      throw new Error(addMembershipError.message);
    }
  }

  const inviteIds = pendingInvites.map((invite) => invite.id);
  const { error: deleteInviteError } = await supabase
    .from("organization_invites")
    .delete()
    .in("id", inviteIds)
    .eq("email", normalizedEmail)
    .eq("status", "pending");

  if (deleteInviteError) {
    throw new Error(deleteInviteError.message);
  }
}

function isSuperAdminEmail(email: string) {
  return normalizeEmail(email) === SUPER_ADMIN_EMAIL;
}

async function resolveSuperAdminUserId() {
  if (typeof cachedSuperAdminUserId !== "undefined") {
    return cachedSuperAdminUserId;
  }

  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    cachedSuperAdminUserId = null;
    return null;
  }

  const { data, error } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000
  });

  if (error) {
    cachedSuperAdminUserId = null;
    return null;
  }

  const user = (data?.users ?? []).find(
    (candidate) => normalizeEmail(candidate.email ?? "") === SUPER_ADMIN_EMAIL
  );
  cachedSuperAdminUserId = user?.id ?? null;
  return cachedSuperAdminUserId;
}

function isBillingSchemaMissing(message: string) {
  return /organization_billing_subscriptions|organization_billing_payments|requested_organization_name|requested_organization_slug|created_organization_id|purpose/i.test(
    message
  );
}

async function getAdminFreeTrialStatus(userId: string): Promise<FreeTrialStatus> {
  const supabase = await createSupabaseServerClient();
  const { data: firstCreatedOrganization, error } = await supabase
    .from("organizations")
    .select("id, created_at")
    .eq("created_by", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!firstCreatedOrganization?.created_at) {
    return {
      hasCreatedOrganization: false,
      firstOrganizationCreatedAt: null,
      trialEndsAt: null,
      trialExpired: false
    };
  }

  const trialEndsAt = addDaysToIsoDate(firstCreatedOrganization.created_at, FREE_TRIAL_DAYS);
  return {
    hasCreatedOrganization: true,
    firstOrganizationCreatedAt: firstCreatedOrganization.created_at,
    trialEndsAt,
    trialExpired: isIsoDateExpired(trialEndsAt)
  };
}

export async function getAdminOrganizationCreationAccess(admin: AdminSession) {
  if (admin.isSuperAdmin) {
    return {
      canCreateOrganization: true,
      reason: null as string | null
    };
  }

  const freeTrialStatus = await getAdminFreeTrialStatus(admin.userId);
  if (!freeTrialStatus.hasCreatedOrganization) {
    return {
      canCreateOrganization: true,
      reason: null as string | null
    };
  }

  return {
    canCreateOrganization: false,
    reason:
      "Ya consumiste tu organizacion free. Para crear una nueva vas a necesitar activar el plan pago."
  };
}

export async function assertCanCreateOrganization(admin: AdminSession) {
  if (admin.isSuperAdmin) return;

  const creationAccess = await getAdminOrganizationCreationAccess(admin);
  if (creationAccess.canCreateOrganization) return;
  throw new Error(
    creationAccess.reason ??
      "Cada cuenta tiene 1 organizacion free. Para crear una nueva organizacion tendras que activar el plan pago."
  );
}

export async function getOrganizationWriteAccess(
  admin: AdminSession,
  organizationId: string
): Promise<OrganizationWriteAccess> {
  if (admin.isSuperAdmin) {
    return {
      canWrite: true,
      reason: null,
      organizationTrialEndsAt: null,
      organizationTrialExpired: false,
      adminTrialEndsAt: null,
      adminTrialExpired: false,
      subscriptionStatus: null,
      subscriptionCurrentPeriodEnd: null,
      subscriptionActive: false
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("id, created_at, created_by")
    .eq("id", organizationId)
    .maybeSingle();

  if (organizationError) {
    throw new Error(organizationError.message);
  }

  if (!organization?.created_at) {
    throw new Error("La organizacion no existe.");
  }

  const superAdminUserId = await resolveSuperAdminUserId();
  const isSuperAdminOwnedOrganization = Boolean(
    superAdminUserId && organization.created_by === superAdminUserId
  );
  if (isSuperAdminOwnedOrganization) {
    return {
      canWrite: true,
      reason: null,
      organizationTrialEndsAt: null,
      organizationTrialExpired: false,
      adminTrialEndsAt: null,
      adminTrialExpired: false,
      subscriptionStatus: null,
      subscriptionCurrentPeriodEnd: null,
      subscriptionActive: false
    };
  }

  const organizationTrialEndsAt = getOrganizationTrialEndsAt(organization.created_at);
  const organizationTrialExpired = isIsoDateExpired(organizationTrialEndsAt);

  const { data: subscription, error: subscriptionError } = await supabase
    .from("organization_billing_subscriptions")
    .select("status, current_period_end")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (subscriptionError && !isBillingSchemaMissing(subscriptionError.message)) {
    throw new Error(subscriptionError.message);
  }

  const safeSubscription = subscriptionError && isBillingSchemaMissing(subscriptionError.message) ? null : subscription;
  const subscriptionStatus = safeSubscription?.status ?? null;
  const subscriptionCurrentPeriodEnd = safeSubscription?.current_period_end ?? null;
  const subscriptionActive = hasActiveOrganizationSubscription(safeSubscription);

  const userTrial = await getAdminFreeTrialStatus(admin.userId);
  const adminTrialEndsAt = userTrial.trialEndsAt;
  const adminTrialExpired = userTrial.trialExpired;

  if (organizationTrialExpired && !subscriptionActive) {
    return {
      canWrite: false,
      reason: `La organizacion supero su mes free (vencio el ${toShortDate(
        organizationTrialEndsAt
      )}). Necesita activar el plan mensual para volver a gestionar.`,
      organizationTrialEndsAt,
      organizationTrialExpired: true,
      adminTrialEndsAt,
      adminTrialExpired,
      subscriptionStatus,
      subscriptionCurrentPeriodEnd,
      subscriptionActive
    };
  }

  return {
    canWrite: true,
    reason: null,
    organizationTrialEndsAt,
    organizationTrialExpired,
    adminTrialEndsAt,
    adminTrialExpired,
    subscriptionStatus,
    subscriptionCurrentPeriodEnd,
    subscriptionActive
  };
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user?.id || !user.email) {
    return null;
  }

  const email = normalizeEmail(user.email);
  const profile = await ensureAdminProfile({
    userId: user.id,
    email,
    metadata: (user.user_metadata ?? undefined) as Record<string, unknown> | undefined
  });

  await autoAcceptOrganizationInvites(user.id, email);
  if (isSuperAdminEmail(email)) {
    cachedSuperAdminUserId = user.id;
  }

  return {
    userId: user.id,
    email,
    displayName: profile.display_name,
    isSuperAdmin: isSuperAdminEmail(email)
  };
}

export async function requireAdminSession() {
  const adminSession = await getAdminSession();
  if (!adminSession) {
    redirect("/admin/login");
  }
  return adminSession;
}

export async function assertAdminAction() {
  const adminSession = await getAdminSession();
  if (!adminSession) {
    throw new Error("No autorizado: debes iniciar sesion.");
  }
  return adminSession;
}

export async function getAdminOrganizations(admin: AdminSession): Promise<AdminOrganization[]> {
  const supabase = await createSupabaseServerClient();

  if (admin.isSuperAdmin) {
    const { data, error } = await supabase
      .from("organizations")
      .select("id, name, slug, is_public, created_at")
      .order("name", { ascending: true });

    if (error) throw new Error(error.message);
    return data ?? [];
  }

  const [{ data: createdOrganizations, error: createdOrganizationsError }, { data, error }] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, slug, is_public, created_at")
      .eq("created_by", admin.userId),
    supabase
      .from("organization_admins")
      .select("organizations(id, name, slug, is_public, created_at)")
      .eq("admin_id", admin.userId)
  ]);

  if (createdOrganizationsError) throw new Error(createdOrganizationsError.message);
  if (error) throw new Error(error.message);

  const organizationsById = new Map<string, AdminOrganization>();
  for (const organization of createdOrganizations ?? []) {
    organizationsById.set(organization.id, organization);
  }

  for (const row of data ?? []) {
    const relation = row.organizations;
    const value = Array.isArray(relation) ? relation[0] ?? null : relation ?? null;
    if (value && typeof value.id === "string" && typeof value.name === "string") {
      organizationsById.set(value.id, value as AdminOrganization);
    }
  }

  return Array.from(organizationsById.values()).sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export async function getOrganizationQueryKeyById(organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("slug")
    .eq("id", organizationId)
    .maybeSingle();

  if (error || !data?.slug) return organizationId;
  return data.slug;
}

export async function getAdminOrganizationContext(preferredOrganizationKey?: string | null) {
  const admin = await requireAdminSession();
  const organizations = await getAdminOrganizations(admin);

  const selectedOrganization = findOrganizationByKey(organizations, preferredOrganizationKey) ?? organizations[0] ?? null;

  return {
    admin,
    organizations,
    selectedOrganization
  };
}

export async function requireAdminOrganization(preferredOrganizationId?: string | null) {
  const context = await getAdminOrganizationContext(preferredOrganizationId);

  if (!context.selectedOrganization) {
    redirect("/admin");
  }

  return {
    ...context,
    selectedOrganization: context.selectedOrganization
  };
}

async function assertOrganizationMembership(organizationId: string) {
  const admin = await assertAdminAction();

  if (admin.isSuperAdmin) {
    return admin;
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: membership, error: membershipError }, { data: createdByUser, error: creatorError }] =
    await Promise.all([
      supabase
        .from("organization_admins")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("admin_id", admin.userId)
        .maybeSingle(),
      supabase
        .from("organizations")
        .select("id")
        .eq("id", organizationId)
        .eq("created_by", admin.userId)
        .maybeSingle()
    ]);

  const hasAccess = Boolean(membership || createdByUser);
  if (!hasAccess && (membershipError || creatorError)) {
    throw new Error(membershipError?.message ?? creatorError?.message ?? "No autorizado para administrar esta organizacion.");
  }

  if (!hasAccess) {
    throw new Error("No autorizado para administrar esta organizacion.");
  }

  return admin;
}

export async function assertOrganizationMembershipAction(organizationId: string) {
  return assertOrganizationMembership(organizationId);
}

export async function assertOrganizationAdminAction(organizationId: string) {
  const admin = await assertOrganizationMembership(organizationId);

  const writeAccess = await getOrganizationWriteAccess(admin, organizationId);
  if (!writeAccess.canWrite) {
    throw new Error(writeAccess.reason ?? "No tienes acceso de escritura para esta organizacion.");
  }

  return admin;
}
