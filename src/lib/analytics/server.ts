import { getAnalyticsAttribution } from "@/lib/analytics/attribution";
import { isAnalyticsEventName, sanitizeAnalyticsPath, sanitizeAnalyticsProperties, type AnalyticsEventName } from "@/lib/analytics/events";
import { logWarn } from "@/lib/observability/log";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AnalyticsDbClient = {
  from(table: "analytics_events"): {
    insert(payload: Record<string, unknown>): {
      select(columns: string): {
        single(): PromiseLike<{
          data: unknown;
          error: { message: string; code?: string } | null;
        }>;
      };
    };
  };
};

export type AnalyticsEntityType =
  | "admin"
  | "organization"
  | "match"
  | "export";

export type AnalyticsEventInput = {
  eventName: AnalyticsEventName | string;
  source?: string | null;
  adminId?: string | null;
  organizationId?: string | null;
  eventKey?: string | null;
  entityType?: AnalyticsEntityType | string | null;
  entityId?: string | null;
  path?: string | null;
  properties?: Record<string, unknown> | null;
};

const MAX_SOURCE_LENGTH = 80;
const MISSING_ANALYTICS_TABLE_PATTERN =
  /analytics_events|schema cache|does not exist|relation .*analytics_events/i;

function normalizeText(value: string | null | undefined, maxLength: number) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

export function buildAnalyticsEventInsert(input: AnalyticsEventInput) {
  if (!isAnalyticsEventName(input.eventName)) {
    return null;
  }

  return {
    event_name: input.eventName,
    source: normalizeText(input.source, MAX_SOURCE_LENGTH) ?? "server",
    admin_id: input.adminId ?? null,
    organization_id: input.organizationId ?? null,
    event_key: normalizeText(input.eventKey ?? (["group_created", "match_created", "match_finished", "admin_register_succeeded"].includes(input.eventName) && input.entityId ? `${input.eventName}:${input.entityId}` : null), 160),
    entity_type: normalizeText(input.entityType, 40),
    entity_id: input.entityId ?? null,
    path: sanitizeAnalyticsPath(input.path),
    properties: sanitizeAnalyticsProperties(input.properties)
  };
}

export async function insertAnalyticsEvent(supabase: AnalyticsDbClient, input: AnalyticsEventInput) {
  const payload = buildAnalyticsEventInsert(input);
  if (!payload) {
    return {
      recorded: false,
      reason: "event_not_allowed"
    };
  }

  const { data, error } = await supabase.from("analytics_events").insert(payload).select("id").single();
  if (error) {
    if (error.code === "23505" && payload.event_key) return { recorded: false, reason: "duplicate" };
    throw new Error(error.message);
  }

  const row = data && typeof data === "object" ? (data as { id?: string | null }) : null;

  return {
    recorded: true,
    id: row?.id ?? null,
    reason: null
  };
}

export async function recordAnalyticsEvent(input: AnalyticsEventInput) {
  try {
    const supabaseAdmin = createSupabaseAdminClient();
    if (!supabaseAdmin) {
      logWarn("analytics.event.skipped", {
        reason: "missing_service_role",
        eventName: input.eventName
      });
      return {
        recorded: false,
        reason: "missing_service_role"
      };
    }

    return await insertAnalyticsEvent(supabaseAdmin, { ...input, properties: { ...await getAnalyticsAttribution(), ...input.properties } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logWarn("analytics.event.skipped", {
      reason: MISSING_ANALYTICS_TABLE_PATTERN.test(message) ? "analytics_table_missing" : "insert_failed",
      eventName: input.eventName
    });
    return {
      recorded: false,
      reason: message
    };
  }
}
