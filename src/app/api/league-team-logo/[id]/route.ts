import { NextResponse } from "next/server";

import { getTeamLogosBucket } from "@/lib/env";
import { isTournamentsEnabled } from "@/lib/features";
import {
  createSignedStorageRedirect,
  createStorageObjectStreamResponse
} from "@/lib/storage-image-responses";
import { TEAM_LOGO_CACHE_CONTROL } from "@/lib/team-logos";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  _: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  if (!isTournamentsEnabled()) {
    return new NextResponse(null, { status: 404 });
  }

  const { id: leagueTeamId } = await context.params;
  const supabase = await createSupabaseServerClient();
  const { data: team, error } = await supabase
    .from("league_teams")
    .select("logo_path")
    .eq("id", leagueTeamId)
    .maybeSingle();

  if (error || !team?.logo_path) {
    return new NextResponse(null, { status: 404 });
  }

  const bucketName = getTeamLogosBucket();
  const objectPath = String(team.logo_path);
  const signedRedirect = await createSignedStorageRedirect({
    supabase,
    bucketName,
    objectPath
  });

  if (signedRedirect) return signedRedirect;

  const streamedResponse = await createStorageObjectStreamResponse({
    supabase,
    bucketName,
    objectPath,
    contentType: "image/webp",
    cacheControl: TEAM_LOGO_CACHE_CONTROL
  });

  if (!streamedResponse) {
    return new NextResponse(null, { status: 404 });
  }

  return streamedResponse;
}
