import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type DbClient =
  | Awaited<ReturnType<typeof createSupabaseServerClient>>
  | NonNullable<ReturnType<typeof createSupabaseAdminClient>>;

export type OrganizationAuditEventType =
  | "organization.created"
  | "organization.admin_invite.created"
  | "organization.admin_invite.accepted"
  | "organization.admin_invite.revoked"
  | "organization.admin.removed";

export type OrganizationAuditEventInput = {
  organizationId: string;
  eventType: OrganizationAuditEventType;
  actorAdminId?: string | null;
  actorEmail?: string | null;
  targetAdminId?: string | null;
  targetEmail?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  details?: Record<string, unknown> | null;
};

function normalizeEmailSnapshot(email: string | null | undefined) {
  const value = email?.trim().toLowerCase();
  return value || null;
}

export function buildOrganizationAuditEventInsert(input: OrganizationAuditEventInput) {
  return {
    organization_id: input.organizationId,
    event_type: input.eventType,
    actor_admin_id: input.actorAdminId ?? null,
    actor_email: normalizeEmailSnapshot(input.actorEmail),
    target_admin_id: input.targetAdminId ?? null,
    target_email: normalizeEmailSnapshot(input.targetEmail),
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    details: input.details ?? {}
  };
}

export async function insertOrganizationAuditEvent(
  supabase: DbClient,
  input: OrganizationAuditEventInput
) {
  const { data, error } = await supabase
    .from("organization_audit_events")
    .insert(buildOrganizationAuditEventInsert(input))
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    recorded: true,
    id: data?.id ?? null
  };
}

export async function recordOrganizationAuditEvent(input: OrganizationAuditEventInput) {
  const supabaseAdmin = createSupabaseAdminClient();
  if (!supabaseAdmin) {
    console.warn("[organization-audit] SUPABASE_SERVICE_ROLE_KEY no esta configurada; se omite auditoria.", {
      organizationId: input.organizationId,
      eventType: input.eventType
    });
    return {
      recorded: false,
      reason: "missing_service_role"
    };
  }

  try {
    await insertOrganizationAuditEvent(supabaseAdmin, input);
    return {
      recorded: true,
      reason: null
    };
  } catch (error) {
    console.error("[organization-audit] no se pudo registrar evento", {
      organizationId: input.organizationId,
      eventType: input.eventType,
      message: error instanceof Error ? error.message : String(error)
    });
    return {
      recorded: false,
      reason: error instanceof Error ? error.message : String(error)
    };
  }
}
