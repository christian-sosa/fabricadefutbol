import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { getPlayerPhotosBucket, getSupabaseDbSchema } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const PHOTO_EXTENSIONS = ["jpg", "jpeg", "png", "webp"] as const;

const CONTENT_TYPE_BY_EXTENSION: Record<(typeof PHOTO_EXTENSIONS)[number], string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp"
};
// Las fotos de jugador cambian raramente. Permitimos cache del navegador y
// CDN por 1h, y servimos "stale" hasta 1 dia mientras revalidamos en segundo
// plano. Si se sube una foto nueva, el path termina siendo el mismo pero el
// usuario puede hacer hard-refresh; para invalidar agresivamente se puede
// agregar un query ?v= en el <img src> a futuro.
const PHOTO_CACHE_CONTROL = "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400";
const PLACEHOLDER_CACHE_CONTROL = "public, max-age=86400, immutable";

function getLegacyPhotoPath(playerId: string, extension: (typeof PHOTO_EXTENSIONS)[number]) {
  return path.join(process.cwd(), "public", "players", `${playerId}.${extension}`);
}

function getPlaceholderPath() {
  return path.join(process.cwd(), "public", "avatar-placeholder.svg");
}

function getStorageObjectPath(schema: string, organizationId: string, playerId: string) {
  return `${schema}/${organizationId}/${playerId}.webp`;
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
      "cache-control": PHOTO_CACHE_CONTROL
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
  const file = await readFile(getPlaceholderPath());
  return new NextResponse(file, {
    headers: {
      "content-type": "image/svg+xml",
      "cache-control": PLACEHOLDER_CACHE_CONTROL
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
      getStorageObjectPath(schemaName, player.organization_id, playerId),
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
            "cache-control": PHOTO_CACHE_CONTROL
          }
        });
      }
    }
  }

  const legacyResponse = await readLegacyPhotoResponse(playerId);
  if (legacyResponse) return legacyResponse;
  return readPlaceholderResponse();
}
