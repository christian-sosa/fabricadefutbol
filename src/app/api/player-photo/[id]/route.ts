import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

const PHOTO_EXTENSIONS = ["jpg", "jpeg", "png", "webp"] as const;

const CONTENT_TYPE_BY_EXTENSION: Record<(typeof PHOTO_EXTENSIONS)[number], string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp"
};

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

export async function GET(
  _: Request,
  context: {
    params: { id: string };
  }
) {
  const playerId = context.params.id;

  for (const extension of PHOTO_EXTENSIONS) {
    const absolutePath = path.join(process.cwd(), "public", "players", `${playerId}.${extension}`);
    const exists = await fileExists(absolutePath);
    if (exists) {
      return readImageResponse(absolutePath, CONTENT_TYPE_BY_EXTENSION[extension]);
    }
  }

  const placeholderPath = path.join(process.cwd(), "public", "avatar-placeholder.svg");
  return readImageResponse(placeholderPath, "image/svg+xml");
}
