import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { isAnalyticsEventName } from "@/lib/analytics/events";
import { recordAnalyticsEvent } from "@/lib/analytics/server";
import { getAdminSession } from "@/lib/auth/admin";

const analyticsEventSchema = z.object({
  eventName: z.string(),
  source: z.string().max(80).optional(),
  path: z.string().max(500).optional(),
  organizationId: z.string().uuid().optional(),
  clubId: z.string().uuid().optional(),
  leagueId: z.string().uuid().optional(),
  entityType: z.string().max(40).optional(),
  entityId: z.string().uuid().optional(),
  properties: z.record(z.unknown()).optional()
});

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido." }, { status: 400 });
  }

  const parsed = analyticsEventSchema.safeParse(payload);
  if (!parsed.success || !isAnalyticsEventName(parsed.data.eventName)) {
    return NextResponse.json({ error: "Evento invalido." }, { status: 400 });
  }

  const admin = await getAdminSession();
  const result = await recordAnalyticsEvent({
    eventName: parsed.data.eventName,
    source: parsed.data.source ?? "client",
    adminId: admin?.userId ?? null,
    organizationId: parsed.data.organizationId ?? null,
    clubId: parsed.data.clubId ?? null,
    leagueId: parsed.data.leagueId ?? null,
    entityType: parsed.data.entityType ?? null,
    entityId: parsed.data.entityId ?? null,
    path: parsed.data.path ?? request.nextUrl.pathname,
    properties: parsed.data.properties ?? {}
  });

  return NextResponse.json({ recorded: result.recorded });
}
