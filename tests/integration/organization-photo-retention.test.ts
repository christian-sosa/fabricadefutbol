import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { purgeExpiredOrganizationPlayerPhotos } from "@/lib/domain/organization-photo-retention";
import { createFakeSupabase } from "../helpers/fake-supabase";

const ORG_ID = "org-1";

describe("organization photo retention", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-20T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("programa el purge mientras el grupo sigue impago pero aun dentro de los 90 dias", async () => {
    const fake = createFakeSupabase({
      organizations: [
        {
          id: ORG_ID,
          name: "La cantera",
          slug: "la-cantera",
          created_at: "2026-03-25T00:00:00.000Z"
        }
      ]
    });
    const removedPaths: string[][] = [];

    const summary = await purgeExpiredOrganizationPlayerPhotos({
      supabase: {
        ...fake.client,
        storage: {
          from: () => ({
            remove: async (paths: string[]) => {
              removedPaths.push(paths);
              return { data: [], error: null };
            }
          })
        }
      } as never,
      bucketName: "player-photos-dev",
      schemaName: "app_dev"
    });

    expect(summary).toEqual({
      scannedOrganizations: 1,
      scheduledOrganizations: 1,
      purgedOrganizations: 0,
      deletedPlayerPhotos: 0,
      clearedUploadEvents: 0,
      resetOrganizations: 0
    });
    expect(removedPaths).toEqual([]);
    expect(fake.find("organizations", (row) => row.id === ORG_ID)).toEqual(
      expect.objectContaining({
        player_photos_purge_at: "2026-07-23T00:00:00.000Z",
        player_photos_purged_at: null
      })
    );
  });

  it("borra fotos de jugadores cuando pasan 90 dias de impago y conserva la imagen del grupo", async () => {
    const fake = createFakeSupabase({
      organizations: [
        {
          id: ORG_ID,
          name: "La cantera",
          slug: "la-cantera",
          image_path: "app_dev/organizations/org-1.webp",
          created_at: "2026-01-01T00:00:00.000Z"
        }
      ],
      organization_billing_subscriptions: [
        {
          organization_id: ORG_ID,
          status: "active",
          current_period_end: "2026-02-10T00:00:00.000Z"
        }
      ],
      players: [
        {
          id: "player-1",
          organization_id: ORG_ID,
          full_name: "Juan",
          initial_rank: 1
        },
        {
          id: "player-2",
          organization_id: ORG_ID,
          full_name: "Pedro",
          initial_rank: 2
        }
      ],
      player_photo_upload_events: [
        {
          uploader_id: "admin-1",
          uploader_role: "organization_admin",
          target_type: "organization_player",
          target_player_id: "player-1"
        },
        {
          uploader_id: "admin-1",
          uploader_role: "organization_admin",
          target_type: "organization_player",
          target_player_id: "player-2"
        },
        {
          uploader_id: "captain-1",
          uploader_role: "captain",
          target_type: "competition_player",
          target_player_id: "comp-player-1"
        }
      ]
    });
    const removedPaths: string[][] = [];

    const summary = await purgeExpiredOrganizationPlayerPhotos({
      supabase: {
        ...fake.client,
        storage: {
          from: (bucketName: string) => ({
            remove: async (paths: string[]) => {
              expect(bucketName).toBe("player-photos-dev");
              removedPaths.push(paths);
              return { data: [], error: null };
            }
          })
        }
      } as never,
      bucketName: "player-photos-dev",
      schemaName: "app_dev"
    });

    expect(summary).toEqual({
      scannedOrganizations: 1,
      scheduledOrganizations: 0,
      purgedOrganizations: 1,
      deletedPlayerPhotos: 2,
      clearedUploadEvents: 2,
      resetOrganizations: 0
    });
    expect(removedPaths).toEqual([
      ["app_dev/org-1/player-1.webp", "app_dev/org-1/player-2.webp"]
    ]);
    expect(fake.find("organizations", (row) => row.id === ORG_ID)).toEqual(
      expect.objectContaining({
        image_path: "app_dev/organizations/org-1.webp",
        player_photos_purge_at: "2026-05-11T00:00:00.000Z",
        player_photos_purged_at: "2026-05-20T12:00:00.000Z"
      })
    );
    expect(fake.table("player_photo_upload_events")).toEqual([
      expect.objectContaining({
        target_type: "competition_player",
        target_player_id: "comp-player-1"
      })
    ]);
  });

  it("resetea la retencion si el grupo vuelve a tener acceso activo", async () => {
    const fake = createFakeSupabase({
      organizations: [
        {
          id: ORG_ID,
          name: "La cantera",
          slug: "la-cantera",
          created_at: "2026-01-01T00:00:00.000Z",
          player_photos_purge_at: "2026-05-11T00:00:00.000Z",
          player_photos_purged_at: "2026-05-12T12:00:00.000Z"
        }
      ],
      organization_billing_subscriptions: [
        {
          organization_id: ORG_ID,
          status: "active",
          current_period_end: "2026-06-25T00:00:00.000Z"
        }
      ]
    });
    const removedPaths: string[][] = [];

    const summary = await purgeExpiredOrganizationPlayerPhotos({
      supabase: {
        ...fake.client,
        storage: {
          from: () => ({
            remove: async (paths: string[]) => {
              removedPaths.push(paths);
              return { data: [], error: null };
            }
          })
        }
      } as never,
      bucketName: "player-photos-dev",
      schemaName: "app_dev"
    });

    expect(summary).toEqual({
      scannedOrganizations: 1,
      scheduledOrganizations: 0,
      purgedOrganizations: 0,
      deletedPlayerPhotos: 0,
      clearedUploadEvents: 0,
      resetOrganizations: 1
    });
    expect(removedPaths).toEqual([]);
    expect(fake.find("organizations", (row) => row.id === ORG_ID)).toEqual(
      expect.objectContaining({
        player_photos_purge_at: null,
        player_photos_purged_at: null
      })
    );
  });
});
