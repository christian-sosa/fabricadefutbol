import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const PLAYER_PHOTOS_BUCKET = "player-photos";
const PHOTO_EXTENSIONS = ["jpg", "jpeg", "png", "webp"] as const;

const CONTENT_TYPE_BY_EXTENSION: Record<(typeof PHOTO_EXTENSIONS)[number], string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp"
};

function getLegacyPhotoPath(playerId: string, extension: (typeof PHOTO_EXTENSIONS)[number]) {
  return path.join(process.cwd(), "public", "players", `${playerId}.${extension}`);
}

function getPlaceholderPath() {
  return path.join(process.cwd(), "public", "avatar-placeholder.svg");
}

function getStorageObjectPath(organizationId: string, playerId: string) {
  return `${organizationId}/${playerId}.webp`;
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
      "cache-control": "public, max-age=300"
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
  return readImageResponse(getPlaceholderPath(), "image/svg+xml");
}

export async function GET(
  _: Request,
  context: {
    params: { id: string };
  }
) {
  const playerId = context.params.id;
  const supabase = await createSupabaseServerClient();

  const { data: player, error: playerError } = await supabase
    .from("players")
    .select("organization_id")
    .eq("id", playerId)
    .maybeSingle();

  if (!playerError && player?.organization_id) {
    const objectPath = getStorageObjectPath(player.organization_id, playerId);
    const { data: photoFile, error: photoError } = await supabase.storage
      .from(PLAYER_PHOTOS_BUCKET)
      .download(objectPath);

    if (!photoError && photoFile) {
      const fileBuffer = Buffer.from(await photoFile.arrayBuffer());
      return new NextResponse(fileBuffer, {
        headers: {
          "content-type": "image/webp",
          "cache-control": "public, max-age=300"
        }
      });
    }
  }

  const legacyResponse = await readLegacyPhotoResponse(playerId);
  if (legacyResponse) return legacyResponse;
  return readPlaceholderResponse();
}
