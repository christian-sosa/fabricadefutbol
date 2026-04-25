import { NextResponse } from "next/server";

import { getTeamLogosBucket } from "@/lib/env";
import { TEAM_LOGO_CACHE_CONTROL } from "@/lib/team-logos";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  _: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
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

  const { data: file, error: downloadError } = await supabase.storage
    .from(getTeamLogosBucket())
    .download(String(team.logo_path));

  if (downloadError || !file) {
    return new NextResponse(null, { status: 404 });
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  return new NextResponse(fileBuffer, {
    headers: {
      "content-type": "image/webp",
      "cache-control": TEAM_LOGO_CACHE_CONTROL
    }
  });
}
