import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  MAX_ORGANIZATION_IMAGE_SIZE_MB,
  ORGANIZATION_IMAGE_CACHE_CONTROL,
  ORGANIZATION_IMAGE_HEIGHT_PX,
  ORGANIZATION_IMAGE_QUALITY,
  ORGANIZATION_IMAGE_WIDTH_PX
} from "@/lib/organization-images";
import {
  MAX_PLAYER_PHOTO_SIZE_MB,
  PLAYER_AVATAR_QUALITY,
  PLAYER_AVATAR_SIZE_PX
} from "@/lib/player-photos";

const root = process.cwd();
const playerPhotoRouteSource = readFileSync(
  path.join(root, "src", "app", "api", "player-photo", "[id]", "route.ts"),
  "utf8"
);

describe("media cost controls", () => {
  it("mantiene limites conservadores para fotos de jugadores", () => {
    expect(MAX_PLAYER_PHOTO_SIZE_MB).toBe(5);
    expect(PLAYER_AVATAR_SIZE_PX).toBe(320);
    expect(PLAYER_AVATAR_QUALITY).toBe(72);
  });

  it("mantiene limites conservadores para imagenes de grupo", () => {
    expect(MAX_ORGANIZATION_IMAGE_SIZE_MB).toBe(8);
    expect(ORGANIZATION_IMAGE_WIDTH_PX).toBe(1200);
    expect(ORGANIZATION_IMAGE_HEIGHT_PX).toBe(675);
    expect(ORGANIZATION_IMAGE_QUALITY).toBe(78);
    expect(ORGANIZATION_IMAGE_CACHE_CONTROL).toContain("public");
    expect(ORGANIZATION_IMAGE_CACHE_CONTROL).toContain("stale-while-revalidate");
    expect(ORGANIZATION_IMAGE_CACHE_CONTROL).not.toBe("no-store");
  });

  it("evita descargar fotos si puede redirigir a una URL firmada de storage", () => {
    expect(playerPhotoRouteSource).toContain("createSignedStorageRedirect");
    expect(playerPhotoRouteSource).toContain("getStoragePhotoResponse");
  });

  it("descarta ids invalidos antes de consultar storage o base de datos", () => {
    expect(playerPhotoRouteSource).toContain("isUuidLikePlayerId");
    expect(playerPhotoRouteSource).toMatch(/if \(!isUuidLikePlayerId\(playerId\)\)/);
  });
});
