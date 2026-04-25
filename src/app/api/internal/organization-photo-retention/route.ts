import { NextResponse } from "next/server";

import { purgeExpiredOrganizationPlayerPhotos } from "@/lib/domain/organization-photo-retention";
import { getInternalCronSecret, getPlayerPhotosBucket, getSupabaseDbSchema } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const secret = getInternalCronSecret();

  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Falta SUPABASE_SERVICE_ROLE_KEY para ejecutar la retencion de fotos." },
      { status: 503 }
    );
  }

  try {
    const summary = await purgeExpiredOrganizationPlayerPhotos({
      supabase,
      bucketName: getPlayerPhotosBucket(),
      schemaName: getSupabaseDbSchema()
    });

    return NextResponse.json({
      ok: true,
      executedAt: new Date().toISOString(),
      summary
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "No se pudo ejecutar la retencion."
      },
      { status: 500 }
    );
  }
}
