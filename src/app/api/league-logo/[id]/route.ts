import { NextResponse } from "next/server";

import { getLeagueLogosBucket } from "@/lib/env";
import {
  buildLeagueLogoPlaceholderSvg,
  LEAGUE_LOGO_CACHE_CONTROL,
  LEAGUE_LOGO_PLACEHOLDER_CACHE_CONTROL
} from "@/lib/league-logos";
import {
  createSignedStorageRedirect,
  createStorageObjectStreamResponse
} from "@/lib/storage-image-responses";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function buildPlaceholderResponse(leagueName: string) {
  return new NextResponse(buildLeagueLogoPlaceholderSvg(leagueName), {
    headers: {
      "content-type": "image/svg+xml",
      "cache-control": LEAGUE_LOGO_PLACEHOLDER_CACHE_CONTROL
    }
  });
}

export async function GET(
  _: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  const { id: leagueId } = await context.params;
  const supabase = await createSupabaseServerClient();
  const { data: league, error } = await supabase
    .from("leagues")
    .select("name, logo_path")
    .eq("id", leagueId)
    .maybeSingle();

  if (error || !league) {
    return buildPlaceholderResponse("Liga");
  }

  if (!league.logo_path) {
    return buildPlaceholderResponse(String(league.name ?? "Liga"));
  }

  const bucketName = getLeagueLogosBucket();
  const objectPath = String(league.logo_path);
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
    cacheControl: LEAGUE_LOGO_CACHE_CONTROL
  });

  if (!streamedResponse) {
    return buildPlaceholderResponse(String(league.name ?? "Liga"));
  }

  return streamedResponse;
}
