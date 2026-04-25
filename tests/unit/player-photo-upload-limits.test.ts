import { describe, expect, it } from "vitest";

import {
  assertPlayerPhotoUploadAllowed,
  buildPhotoUploadCooldownMessage,
  CAPTAIN_PLAYER_PHOTO_TOTAL_LIMIT,
  PLAYER_PHOTO_TARGET_LIMIT
} from "@/lib/player-photo-upload-limits";
import { createFakeSupabase } from "../helpers/fake-supabase";

const NOW = new Date("2026-04-25T12:00:00.000Z");

describe("player photo upload limits", () => {
  it("bloquea un tercer reemplazo del mismo jugador dentro de 3 meses", async () => {
    const fake = createFakeSupabase({
      player_photo_upload_events: [
        {
          id: "event-1",
          uploader_id: "admin-1",
          uploader_role: "organization_admin",
          target_type: "organization_player",
          target_player_id: "player-1",
          created_at: "2026-03-01T12:00:00.000Z"
        },
        {
          id: "event-2",
          uploader_id: "admin-1",
          uploader_role: "organization_admin",
          target_type: "organization_player",
          target_player_id: "player-1",
          created_at: "2026-04-01T12:00:00.000Z"
        }
      ]
    });

    await expect(
      assertPlayerPhotoUploadAllowed({
        supabase: fake.client as never,
        uploaderId: "admin-1",
        uploaderRole: "organization_admin",
        targetPlayerId: "player-1",
        targetType: "organization_player",
        now: NOW
      })
    ).rejects.toThrow(String(PLAYER_PHOTO_TARGET_LIMIT));
  });

  it("permite volver a subir cuando el historial ya salio de la ventana", async () => {
    const fake = createFakeSupabase({
      player_photo_upload_events: [
        {
          id: "event-1",
          uploader_id: "admin-1",
          uploader_role: "organization_admin",
          target_type: "organization_player",
          target_player_id: "player-1",
          created_at: "2025-12-01T12:00:00.000Z"
        },
        {
          id: "event-2",
          uploader_id: "admin-1",
          uploader_role: "organization_admin",
          target_type: "organization_player",
          target_player_id: "player-1",
          created_at: "2026-01-01T12:00:00.000Z"
        }
      ]
    });

    await expect(
      assertPlayerPhotoUploadAllowed({
        supabase: fake.client as never,
        uploaderId: "admin-1",
        uploaderRole: "organization_admin",
        targetPlayerId: "player-1",
        targetType: "organization_player",
        now: NOW
      })
    ).resolves.toBeUndefined();
  });

  it("bloquea al capitan cuando llega al tope total del periodo", async () => {
    const fake = createFakeSupabase({
      player_photo_upload_events: Array.from({ length: CAPTAIN_PLAYER_PHOTO_TOTAL_LIMIT }, (_, index) => ({
        id: `event-${index + 1}`,
        uploader_id: "captain-1",
        uploader_role: "captain",
        target_type: "competition_player",
        target_player_id: `player-${index + 1}`,
        created_at: "2026-04-01T12:00:00.000Z"
      }))
    });

    await expect(
      assertPlayerPhotoUploadAllowed({
        supabase: fake.client as never,
        uploaderId: "captain-1",
        uploaderRole: "captain",
        targetPlayerId: "player-99",
        targetType: "competition_player",
        now: NOW
      })
    ).rejects.toThrow(String(CAPTAIN_PLAYER_PHOTO_TOTAL_LIMIT));
  });

  it("arma un mensaje amigable de cooldown", () => {
    const message = buildPhotoUploadCooldownMessage({
      label: "reemplazos para este jugador",
      limit: 2,
      oldestAt: "2026-04-01T12:00:00.000Z",
      now: NOW
    });

    expect(message).toContain("2");
    expect(message).toContain("Podras volver a subir");
  });
});
