import { NextResponse } from "next/server";

import { getLeaguePhotosBucket } from "@/lib/env";
import { LEAGUE_PHOTO_CACHE_CONTROL } from "@/lib/league-photos";
import {
  createSignedStorageRedirect,
  createStorageObjectStreamResponse
} from "@/lib/storage-image-responses";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
    .select("photo_path")
    .eq("id", leagueId)
    .maybeSingle();

  if (error || !league?.photo_path) {
    return new NextResponse(null, { status: 404 });
  }

  const bucketName = getLeaguePhotosBucket();
  const objectPath = String(league.photo_path);
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
    cacheControl: LEAGUE_PHOTO_CACHE_CONTROL
  });

  if (!streamedResponse) {
    return new NextResponse(null, { status: 404 });
  }

  return streamedResponse;
}
