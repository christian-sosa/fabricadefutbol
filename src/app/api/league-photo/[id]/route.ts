import { NextResponse } from "next/server";

import { getLeaguePhotosBucket } from "@/lib/env";
import { LEAGUE_PHOTO_CACHE_CONTROL } from "@/lib/league-photos";
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

  const { data: file, error: downloadError } = await supabase.storage
    .from(getLeaguePhotosBucket())
    .download(String(league.photo_path));

  if (downloadError || !file) {
    return new NextResponse(null, { status: 404 });
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  return new NextResponse(fileBuffer, {
    headers: {
      "content-type": "image/webp",
      "cache-control": LEAGUE_PHOTO_CACHE_CONTROL
    }
  });
}
