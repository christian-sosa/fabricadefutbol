import { NextResponse } from "next/server";

import { getLeagueLogosBucket } from "@/lib/env";
import {
  buildLeagueLogoPlaceholderSvg,
  LEAGUE_LOGO_CACHE_CONTROL,
  LEAGUE_LOGO_PLACEHOLDER_CACHE_CONTROL
} from "@/lib/league-logos";
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

  const { data: file, error: downloadError } = await supabase.storage
    .from(getLeagueLogosBucket())
    .download(String(league.logo_path));

  if (downloadError || !file) {
    return buildPlaceholderResponse(String(league.name ?? "Liga"));
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  return new NextResponse(fileBuffer, {
    headers: {
      "content-type": "image/webp",
      "cache-control": LEAGUE_LOGO_CACHE_CONTROL
    }
  });
}
