import { redirect } from "next/navigation";

import { isSuperAdminEmail } from "@/lib/auth/super-admin";
import { deriveDisplayName } from "@/lib/auth/profile";
import { maskEmail, maskUserId } from "@/lib/log-pii";
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
};

export type OrganizationWriteAccess = {
  canWrite: boolean;
  reason: string | null;
  accessValidUntil: string | null;
  writeLockedAt: string | null;
  organizationTrialEndsAt: string | null;
  organizationTrialExpired: boolean;
  adminTrialEndsAt: string | null;
  adminTrialExpired: boolean;
  subscriptionStatus: string | null;
  subscriptionCurrentPeriodEnd: string | null;
  subscriptionActive: boolean;
  playerPhotosPurgeAt: string | null;
  playerPhotosRetentionExpired: boolean;
  playerPhotosPurgedAt: string | null;
};

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

async function ensureAdminProfile(params: {
  userId: string;
  email: string;
  metadata?: Record<string, unknown>;
}) {
  const { userId, email, metadata } = params;
  const adminClient = createSupabaseAdminClient();
  const supabase = adminClient ?? (await createSupabaseServerClient());

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
  const { data: inserted, error: insertedError } = await supabase
    .from("admins")
    .upsert(
      {
        id: userId,
        display_name: fallbackName
      },
      {
        onConflict: "id"
      }
    )
    .select("id, display_name")
    .single();

  if (insertedError || !inserted) {
    console.error("[auth] No se pudo leer el perfil de administrador luego del alta", {
      userId: maskUserId(userId),
      email: maskEmail(email),
      insertedError: insertedError?.message ?? null,
      usingServiceRole: Boolean(adminClient)
    });
    throw new Error(insertedError?.message ?? "No se pudo crear el perfil de administrador.");
  }

  return inserted;
}

async function getAdminFreeTrialStatus(userId: string): Promise<FreeTrialStatus> {
  const supabase = await createSupabaseServerClient();
  const { data: firstCreatedOrganization, error } = await supabase
    .from("organizations")
    .select("id")
    .eq("created_by", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!firstCreatedOrganization?.id) {
    return {
      hasCreatedOrganization: false
    };
  }

  return {
    hasCreatedOrganization: true
  };
}

async function hasAdminMembershipInAnyOrganization(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("organization_admins")
    .select("id", { count: "exact", head: true })
    .eq("admin_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  return (count ?? 0) > 0;
}

export async function getAdminOrganizationCreationAccess(admin: AdminSession) {
  const freeTrialStatus = await getAdminFreeTrialStatus(admin.userId);
  if (!freeTrialStatus.hasCreatedOrganization) {
    const hasMembership = await hasAdminMembershipInAnyOrganization(admin.userId);
    if (hasMembership) {
      return {
        canCreateOrganization: false,
        reason:
          "Ya administrás un grupo. Si querés sumar otro, escribinos y lo habilitamos manualmente."
      };
    }

    return {
      canCreateOrganization: true,
      reason: null as string | null
    };
  }

  return {
    canCreateOrganization: false,
    reason:
      "Ya tenés un grupo para administrar. Si querés sumar otro, escribinos y lo habilitamos manualmente."
  };
}

export async function assertCanCreateOrganization(admin: AdminSession) {
  const creationAccess = await getAdminOrganizationCreationAccess(admin);
  if (creationAccess.canCreateOrganization) return;
  throw new Error(
    creationAccess.reason ??
      "Si querés sumar otro grupo, escribinos y lo habilitamos manualmente."
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
      accessValidUntil: null,
      writeLockedAt: null,
      organizationTrialEndsAt: null,
      organizationTrialExpired: false,
      adminTrialEndsAt: null,
      adminTrialExpired: false,
      subscriptionStatus: null,
      subscriptionCurrentPeriodEnd: null,
      subscriptionActive: false,
      playerPhotosPurgeAt: null,
      playerPhotosRetentionExpired: false,
      playerPhotosPurgedAt: null
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", organizationId)
    .maybeSingle();

  if (organizationError) {
    throw new Error(organizationError.message);
  }

  if (!organization?.id) {
    throw new Error("El grupo no existe.");
  }

  return {
    canWrite: true,
    reason: null,
    accessValidUntil: null,
    writeLockedAt: null,
    organizationTrialEndsAt: null,
    organizationTrialExpired: false,
    adminTrialEndsAt: null,
    adminTrialExpired: false,
    subscriptionStatus: null,
    subscriptionCurrentPeriodEnd: null,
    subscriptionActive: false,
    playerPhotosPurgeAt: null,
    playerPhotosRetentionExpired: false,
    playerPhotosPurgedAt: null
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

  // Antes aqui corriamos `autoAcceptOrganizationInvites` en cada sesion, pero
  // eso aceptaba silenciosamente cualquier invite pendiente que coincidiera
  // con el email del usuario, incluso si nunca habia visto el link.
  // Ahora la aceptacion solo ocurre por el flujo explicito en /invite/[token].
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
    throw new Error(membershipError?.message ?? creatorError?.message ?? "No autorizado para administrar este grupo.");
  }

  if (!hasAccess) {
    throw new Error("No autorizado para administrar este grupo.");
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
    throw new Error(writeAccess.reason ?? "No tienes acceso de escritura para este grupo.");
  }

  return admin;
}
