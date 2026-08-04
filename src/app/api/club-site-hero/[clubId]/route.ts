import { NextResponse } from "next/server";

import {
  CLUB_SITE_HERO_CACHE_CONTROL
} from "@/lib/club-site-media";
import { getClubSiteMediaBucket } from "@/lib/env";
import { canAccessClubsProduct } from "@/lib/features";
import {
  createSignedStorageRedirect,
  createStorageObjectStreamResponse
} from "@/lib/storage-image-responses";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function buildHeroPlaceholderSvg(clubName: string, primaryColor: string, secondaryColor: string) {
  const safeClubName = clubName.replace(/[<>&"]/g, "");
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1800 1100" role="img" aria-label="${safeClubName}">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="${primaryColor}"/>
      <stop offset="0.42" stop-color="${secondaryColor}"/>
      <stop offset="1" stop-color="#050505"/>
    </linearGradient>
  </defs>
  <rect width="1800" height="1100" fill="url(#g)"/>
  <path d="M0 840 C300 710 520 945 830 790 C1110 650 1370 815 1800 650 L1800 1100 L0 1100 Z" fill="rgba(255,255,255,0.12)"/>
  <circle cx="1480" cy="220" r="150" fill="rgba(255,255,255,0.11)"/>
  <text x="100" y="920" fill="rgba(255,255,255,0.78)" font-family="Arial, sans-serif" font-size="112" font-weight="800">${safeClubName}</text>
</svg>`.trim();
}

function buildPlaceholderResponse(clubName: string, primaryColor = "#ff9900", secondaryColor = "#0a0908") {
  return new NextResponse(buildHeroPlaceholderSvg(clubName, primaryColor, secondaryColor), {
    headers: {
      "content-type": "image/svg+xml",
      "cache-control": CLUB_SITE_HERO_CACHE_CONTROL
    }
  });
}

export async function GET(
  _: Request,
  context: {
    params: Promise<{ clubId: string }>;
  }
) {
  if (!canAccessClubsProduct()) {
    return new NextResponse(null, { status: 404 });
  }

  const { clubId } = await context.params;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("club_site_settings")
    .select("hero_image_path, primary_color, secondary_color, clubs(name)")
    .eq("club_id", clubId)
    .maybeSingle();

  if (error || !data) {
    return buildPlaceholderResponse("Club");
  }

  const relation = data.clubs;
  const clubRow = Array.isArray(relation) ? relation[0] ?? null : relation ?? null;
  const clubName = String(clubRow?.name ?? "Club");
  const objectPath = data.hero_image_path ? String(data.hero_image_path) : "";
  if (!objectPath || objectPath.startsWith("/")) {
    return buildPlaceholderResponse(
      clubName,
      String(data.primary_color ?? "#ff9900"),
      String(data.secondary_color ?? "#0a0908")
    );
  }

  const bucketName = getClubSiteMediaBucket();
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
    cacheControl: CLUB_SITE_HERO_CACHE_CONTROL
  });

  if (!streamedResponse) {
    return buildPlaceholderResponse(
      clubName,
      String(data.primary_color ?? "#ff9900"),
      String(data.secondary_color ?? "#0a0908")
    );
  }

  return streamedResponse;
}
