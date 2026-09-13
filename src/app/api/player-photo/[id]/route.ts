import { NextResponse } from "next/server";

import { getPlayerPhotosBucket, getSupabaseDbSchema } from "@/lib/env";
import { isOrganizationPlayerPhotoObjectPath } from "@/lib/player-photos";
import { createSignedStorageRedirect } from "@/lib/storage-image-responses";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const PLAYER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function placeholder(request: Request) {
  const response = NextResponse.redirect(new URL("/avatar-placeholder.svg", request.url), 307);
  response.headers.set("cache-control", "private, no-store");
  return response;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: playerId } = await context.params;
  if (!PLAYER_ID_PATTERN.test(playerId)) return placeholder(request);

  const supabase = await createSupabaseServerClient();
  const { data: player, error } = await supabase
    .from("players")
    .select("organization_id, photo_path")
    .eq("id", playerId)
    .maybeSingle();

  if (error || !player?.organization_id || !player.photo_path) return placeholder(request);
  if (!isOrganizationPlayerPhotoObjectPath(player.photo_path, getSupabaseDbSchema(), player.organization_id, playerId)) return placeholder(request);

  const response = await createSignedStorageRedirect({
    supabase,
    bucketName: getPlayerPhotosBucket(),
    objectPath: player.photo_path
  });
  if (!response) return placeholder(request);
  // Replacements become visible on the next request, including immediately after upload.
  response.headers.set("cache-control", "private, no-store");
  return response;
}
