import { redirect } from "next/navigation";

import { getSessionIsSuperAdmin } from "@/lib/auth/super-admin";
import { requiresMfaVerification } from "@/lib/auth/mfa";
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
  requiresMfa?: boolean;
};

export type AdminOrganization = {
  id: string;
  name: string;
  slug: string;
  is_public: boolean;
  created_at: string;
};

export type OrganizationWriteAccess = {
  canWrite: boolean;
  reason: string | null;
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

export async function getAdminOrganizationCreationAccess(admin: AdminSession) {
  if (!admin.userId) throw new Error("Iniciá sesión antes de crear un grupo.");
  const supabase = await createSupabaseServerClient();
  // SQL includes archived groups that ordinary administrators cannot list through RLS.
  const { data, error } = await supabase.rpc("can_create_organization");
  if (error || typeof data !== "boolean") throw new Error("No se pudo verificar si podés crear un grupo.");
  if (data) {
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
  _admin: AdminSession,
  organizationId: string
): Promise<OrganizationWriteAccess> {
  const supabase = await createSupabaseServerClient();
  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("id, archived_at")
    .eq("id", organizationId)
    .maybeSingle();

  if (organizationError) {
    throw new Error(organizationError.message);
  }

  if (!organization?.id) {
    throw new Error("El grupo no existe.");
  }
  if (organization.archived_at) {
    return { canWrite: false, reason: "El grupo está archivado. Restauralo antes de modificarlo." };
  }

  return {
    canWrite: true,
    reason: null
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
    isSuperAdmin: await getSessionIsSuperAdmin(supabase),
    requiresMfa: await requiresMfaVerification(supabase, user)
  };
}

export async function requireAdminSession() {
  const adminSession = await getAdminSession();
  if (!adminSession) {
    redirect("/admin/login");
  }
  if (adminSession.requiresMfa) redirect("/admin/security");
  return adminSession;
}

export async function assertAdminAction() {
  const adminSession = await getAdminSession();
  if (!adminSession) {
    throw new Error("No autorizado: debes iniciar sesion.");
  }
  if (adminSession.requiresMfa) {
    throw new Error("Verificá tu segundo factor desde Seguridad de la cuenta antes de continuar.");
  }
  return adminSession;
}

export async function getAdminOrganizations(admin: AdminSession): Promise<AdminOrganization[]> {
  const supabase = await createSupabaseServerClient();

  if (admin.isSuperAdmin) {
    const { data, error } = await supabase
      .from("organizations")
      .select("id, name, slug, is_public, created_at")
      .is("archived_at", null)
      .order("name", { ascending: true });

    if (error) throw new Error(error.message);
    return data ?? [];
  }

  const [{ data: createdOrganizations, error: createdOrganizationsError }, { data, error }] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, slug, is_public, created_at")
      .is("archived_at", null)
      .eq("created_by", admin.userId),
    supabase
      .from("organization_admins")
      .select("organizations(id, name, slug, is_public, created_at, archived_at)")
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
    if (value && !value.archived_at && typeof value.id === "string" && typeof value.name === "string") {
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

export async function getArchivedAdminOrganizations(admin: AdminSession): Promise<Array<AdminOrganization & { archived_at: string }>> {
  if (!admin.isSuperAdmin) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("organizations")
    .select("id, name, slug, is_public, created_at, archived_at")
    .not("archived_at", "is", null).order("archived_at", { ascending: false });
  if (error) throw new Error("No se pudieron leer los grupos archivados.");
  return data ?? [];
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
