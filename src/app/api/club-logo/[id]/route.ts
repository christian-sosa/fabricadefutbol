import { NextResponse } from "next/server";

import { getTeamLogosBucket } from "@/lib/env";
import { canAccessClubsProduct } from "@/lib/features";
import { buildLeagueLogoPlaceholderSvg, LEAGUE_LOGO_PLACEHOLDER_CACHE_CONTROL } from "@/lib/league-logos";
import {
  createSignedStorageRedirect,
  createStorageObjectStreamResponse
} from "@/lib/storage-image-responses";
import { TEAM_LOGO_CACHE_CONTROL } from "@/lib/team-logos";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function buildPlaceholderResponse(clubName: string) {
  return new NextResponse(buildLeagueLogoPlaceholderSvg(clubName), {
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
  if (!canAccessClubsProduct()) {
    return new NextResponse(null, { status: 404 });
  }

  const { id: clubId } = await context.params;
  const supabase = await createSupabaseServerClient();
  const { data: club, error } = await supabase
    .from("clubs")
    .select("name, logo_path")
    .eq("id", clubId)
    .maybeSingle();

  if (error || !club) {
    return buildPlaceholderResponse("Club");
  }

  if (!club.logo_path) {
    return buildPlaceholderResponse(String(club.name ?? "Club"));
  }

  const bucketName = getTeamLogosBucket();
  const objectPath = String(club.logo_path);
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
    return buildPlaceholderResponse(String(club.name ?? "Club"));
  }

  return streamedResponse;
}
