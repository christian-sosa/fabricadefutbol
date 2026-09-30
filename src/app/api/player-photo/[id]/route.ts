import { NextResponse } from "next/server";

import { getPlayerPhotosBucket, getSupabaseDbSchema } from "@/lib/env";
import { isOrganizationPlayerPhotoObjectPath } from "@/lib/player-photos";
import { createSignedStorageRedirect } from "@/lib/storage-image-responses";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabasePublicClient } from "@/lib/supabase/public";

const PLAYER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function placeholder(request: Request) {
  const response = NextResponse.redirect(new URL("/avatar-placeholder.svg", request.url), 307);
  response.headers.set("cache-control", "private, no-store");
  return response;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: playerId } = await context.params;
  if (!PLAYER_ID_PATTERN.test(playerId)) return placeholder(request);

  let supabase = await createSupabaseServerClient();
  let { data: player, error } = await supabase
    .from("players")
    .select("organization_id, photo_path")
    .eq("id", playerId)
    .maybeSingle();

  // Administrators retain private previews of their own inactive players. Public
  // photos in other groups use anonymous permissions, independently of the session.
  if (!error && !player) {
    supabase = createSupabasePublicClient();
    ({ data: player, error } = await supabase.from("public_players")
      .select("organization_id, photo_path").eq("id", playerId).maybeSingle());
  }

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
