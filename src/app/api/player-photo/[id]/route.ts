import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";

import { NextResponse } from "next/server";

import { getPlayerPhotosBucket, getSupabaseDbSchema } from "@/lib/env";
import { canAccessClubsProduct } from "@/lib/features";
import {
  CONTENT_TYPE_BY_EXTENSION,
  getClubPlayerPhotoObjectPath,
  getCompetitionPlayerPhotoObjectPath,
  getLegacyPhotoPath,
  getOrganizationPlayerPhotoObjectPath,
  getPlayerPhotoPlaceholderPath,
  getTournamentPlayerPhotoObjectPath,
  PHOTO_EXTENSIONS,
  PLAYER_PHOTO_CACHE_CONTROL,
  PLAYER_PHOTO_PLACEHOLDER_CACHE_CONTROL
} from "@/lib/player-photos";
import { createSignedStorageRedirect, createStorageObjectStreamResponse } from "@/lib/storage-image-responses";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID_LIKE_PLAYER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuidLikePlayerId(playerId: string) {
  return UUID_LIKE_PLAYER_ID_PATTERN.test(playerId);
}

async function fileExists(filePath: string) {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function readImageResponse(filePath: string, contentType: string) {
  const file = await readFile(filePath);
  return new NextResponse(file, {
    headers: {
      "content-type": contentType,
      "cache-control": PLAYER_PHOTO_CACHE_CONTROL
    }
  });
}

async function readLegacyPhotoResponse(playerId: string) {
  for (const extension of PHOTO_EXTENSIONS) {
    const absolutePath = getLegacyPhotoPath(playerId, extension);
    const exists = await fileExists(absolutePath);
    if (exists) {
      return readImageResponse(absolutePath, CONTENT_TYPE_BY_EXTENSION[extension]);
    }
  }
  return null;
}

async function readPlaceholderResponse() {
  const file = await readFile(getPlayerPhotoPlaceholderPath());
  return new NextResponse(file, {
    headers: {
      "content-type": "image/svg+xml",
      "cache-control": PLAYER_PHOTO_PLACEHOLDER_CACHE_CONTROL
    }
  });
}

async function getStoragePhotoResponse(params: {
  supabase: Parameters<typeof createSignedStorageRedirect>[0]["supabase"];
  bucketName: string;
  objectPath: string;
}) {
  const redirectResponse = await createSignedStorageRedirect({
    supabase: params.supabase,
    bucketName: params.bucketName,
    objectPath: params.objectPath
  });
  if (redirectResponse) return redirectResponse;

  return createStorageObjectStreamResponse({
    supabase: params.supabase,
    bucketName: params.bucketName,
    objectPath: params.objectPath,
    contentType: "image/webp",
    cacheControl: PLAYER_PHOTO_CACHE_CONTROL
  });
}

export async function GET(
  _: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  const { id: playerId } = await context.params;
  if (!isUuidLikePlayerId(playerId)) {
    return readPlaceholderResponse();
  }

  const supabase = await createSupabaseServerClient();
  const bucketName = getPlayerPhotosBucket();
  const schemaName = getSupabaseDbSchema();

  const { data: player, error: playerError } = await supabase
    .from("players")
    .select("organization_id")
    .eq("id", playerId)
    .maybeSingle();

  if (!playerError && player?.organization_id) {
    const objectPaths = [
      getOrganizationPlayerPhotoObjectPath(schemaName, player.organization_id, playerId),
      `${player.organization_id}/${playerId}.webp`
    ];

    for (const objectPath of objectPaths) {
      const photoResponse = await getStoragePhotoResponse({
        supabase,
        bucketName,
        objectPath
      });

      if (photoResponse) return photoResponse;
    }
  }

  if (canAccessClubsProduct()) {
    const { data: clubPlayer, error: clubPlayerError } = await supabase
      .from("club_players")
      .select("club_id, photo_path")
      .eq("id", playerId)
      .maybeSingle();

    if (!clubPlayerError && clubPlayer?.club_id) {
      const objectPaths = [
        String(clubPlayer.photo_path ?? ""),
        getClubPlayerPhotoObjectPath(schemaName, String(clubPlayer.club_id), playerId)
      ].filter(Boolean);

      for (const objectPath of objectPaths) {
        const photoResponse = await getStoragePhotoResponse({
          supabase,
          bucketName,
          objectPath
        });

        if (photoResponse) return photoResponse;
      }
    }
  }

  const { data: competitionPlayer, error: competitionPlayerError } = await supabase
    .from("competition_team_players")
    .select("competition_team_id")
    .eq("id", playerId)
    .maybeSingle();

  if (!competitionPlayerError && competitionPlayer?.competition_team_id) {
    const { data: competitionTeam, error: competitionTeamError } = await supabase
      .from("competition_teams")
      .select("competition_id")
      .eq("id", competitionPlayer.competition_team_id)
      .maybeSingle();

    if (!competitionTeamError && competitionTeam?.competition_id) {
      const objectPath = getCompetitionPlayerPhotoObjectPath(
        schemaName,
        competitionTeam.competition_id,
        playerId
      );
      const photoResponse = await getStoragePhotoResponse({
        supabase,
        bucketName,
        objectPath
      });

      if (photoResponse) return photoResponse;
    }
  }

  const { data: tournamentPlayer, error: tournamentPlayerError } = await supabase
    .from("tournament_players")
    .select("tournament_id")
    .eq("id", playerId)
    .maybeSingle();

  if (!tournamentPlayerError && tournamentPlayer?.tournament_id) {
    const objectPath = getTournamentPlayerPhotoObjectPath(schemaName, tournamentPlayer.tournament_id, playerId);
    const photoResponse = await getStoragePhotoResponse({
      supabase,
      bucketName,
      objectPath
    });

    if (photoResponse) return photoResponse;
  }

  const legacyResponse = await readLegacyPhotoResponse(playerId);
  if (legacyResponse) return legacyResponse;
  return readPlaceholderResponse();
}
