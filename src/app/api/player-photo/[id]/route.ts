import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";

import { NextResponse } from "next/server";

import { getPlayerPhotosBucket, getSupabaseDbSchema } from "@/lib/env";
import {
  CONTENT_TYPE_BY_EXTENSION,
  getLegacyPhotoPath,
  getOrganizationPlayerPhotoObjectPath,
  getPlayerPhotoPlaceholderPath,
  getTournamentPlayerPhotoObjectPath,
  PHOTO_EXTENSIONS,
  PLAYER_PHOTO_CACHE_CONTROL,
  PLAYER_PHOTO_PLACEHOLDER_CACHE_CONTROL
} from "@/lib/player-photos";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

export async function GET(
  _: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  const { id: playerId } = await context.params;
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
      const { data: photoFile, error: photoError } = await supabase.storage
        .from(bucketName)
        .download(objectPath);

      if (!photoError && photoFile) {
        const fileBuffer = Buffer.from(await photoFile.arrayBuffer());
        return new NextResponse(fileBuffer, {
          headers: {
            "content-type": "image/webp",
            "cache-control": PLAYER_PHOTO_CACHE_CONTROL
          }
        });
      }
    }
  }

  const { data: tournamentPlayer, error: tournamentPlayerError } = await supabase
    .from("tournament_players")
    .select("tournament_id")
    .eq("id", playerId)
    .maybeSingle();

  if (!tournamentPlayerError && tournamentPlayer?.tournament_id) {
    const objectPath = getTournamentPlayerPhotoObjectPath(
      schemaName,
      tournamentPlayer.tournament_id,
      playerId
    );
    const { data: photoFile, error: photoError } = await supabase.storage.from(bucketName).download(objectPath);

    if (!photoError && photoFile) {
      const fileBuffer = Buffer.from(await photoFile.arrayBuffer());
      return new NextResponse(fileBuffer, {
        headers: {
          "content-type": "image/webp",
          "cache-control": PLAYER_PHOTO_CACHE_CONTROL
        }
      });
    }
  }

  const legacyResponse = await readLegacyPhotoResponse(playerId);
  if (legacyResponse) return legacyResponse;
  return readPlaceholderResponse();
}
