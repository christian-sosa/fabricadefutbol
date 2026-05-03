import { ORGANIZATION_PLAYER_PHOTO_RETENTION_DAYS } from "@/lib/constants";
import { getOrganizationPlayerPhotoObjectPath } from "@/lib/player-photos";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type DbClient =
  | Awaited<ReturnType<typeof createSupabaseServerClient>>
  | NonNullable<ReturnType<typeof createSupabaseAdminClient>>;

type ActivityRow = {
  created_at?: string | null;
  updated_at?: string | null;
};

type OrganizationRetentionRow = {
  created_at: string;
  id: string;
  player_photos_purge_at: string | null;
  player_photos_purged_at: string | null;
  updated_at?: string | null;
};

type OrganizationPlayerRow = ActivityRow & {
  id: string;
};

export type OrganizationPhotoRetentionSummary = {
  scannedOrganizations: number;
  scheduledOrganizations: number;
  purgedOrganizations: number;
  deletedPlayerPhotos: number;
  clearedUploadEvents: number;
  resetOrganizations: number;
};

function addDaysToIsoDate(isoDate: string, days: number) {
  const base = new Date(isoDate);
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function getLatestIsoDate(rows: ActivityRow[]) {
  let latest: string | null = null;
  let latestTime = Number.NEGATIVE_INFINITY;

  for (const row of rows) {
    for (const candidate of [row.updated_at, row.created_at]) {
      if (!candidate) continue;
      const time = new Date(candidate).getTime();
      if (!Number.isFinite(time) || time <= latestTime) continue;
      latest = candidate;
      latestTime = time;
    }
  }

  return latest;
}

async function getOrganizationActivity(params: {
  supabase: DbClient;
  organization: OrganizationRetentionRow;
}) {
  const [{ data: players, error: playersError }, { data: matches, error: matchesError }] =
    await Promise.all([
      params.supabase
        .from("players")
        .select("id, created_at, updated_at")
        .eq("organization_id", params.organization.id),
      params.supabase
        .from("matches")
        .select("id, created_at, updated_at")
        .eq("organization_id", params.organization.id)
    ]);

  if (playersError) throw new Error(playersError.message);
  if (matchesError) throw new Error(matchesError.message);

  const playerRows = (players ?? []) as OrganizationPlayerRow[];
  const matchRows = (matches ?? []) as ActivityRow[];
  const latestActivityAt = getLatestIsoDate([
    { created_at: params.organization.created_at },
    ...playerRows,
    ...matchRows
  ]);

  return {
    latestActivityAt: latestActivityAt ?? params.organization.created_at,
    players: playerRows
  };
}

async function resetRetentionMarkers(params: {
  supabase: DbClient;
  organizationId: string;
}) {
  const { error } = await params.supabase
    .from("organizations")
    .update({
      player_photos_purge_at: null,
      player_photos_purged_at: null
    })
    .eq("id", params.organizationId);
  if (error) throw new Error(error.message);
}

export async function purgeExpiredOrganizationPlayerPhotos(params: {
  supabase: DbClient;
  bucketName: string;
  schemaName: string;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const summary: OrganizationPhotoRetentionSummary = {
    scannedOrganizations: 0,
    scheduledOrganizations: 0,
    purgedOrganizations: 0,
    deletedPlayerPhotos: 0,
    clearedUploadEvents: 0,
    resetOrganizations: 0
  };

  const { data: organizations, error: organizationsError } = await params.supabase
    .from("organizations")
    .select("id, created_at, updated_at, player_photos_purge_at, player_photos_purged_at");

  if (organizationsError) throw new Error(organizationsError.message);

  const organizationsList = (organizations ?? []) as OrganizationRetentionRow[];
  summary.scannedOrganizations = organizationsList.length;

  for (const organization of organizationsList) {
    const activity = await getOrganizationActivity({
      supabase: params.supabase,
      organization
    });
    const desiredPurgeAt = addDaysToIsoDate(
      activity.latestActivityAt,
      ORGANIZATION_PLAYER_PHOTO_RETENTION_DAYS
    );
    const isInactivePastRetention = new Date(desiredPurgeAt).getTime() <= now.getTime();

    if (!isInactivePastRetention) {
      if (organization.player_photos_purge_at || organization.player_photos_purged_at) {
        await resetRetentionMarkers({
          supabase: params.supabase,
          organizationId: organization.id
        });
        summary.resetOrganizations += 1;
      } else if (organization.player_photos_purge_at !== desiredPurgeAt) {
        const { error: scheduleError } = await params.supabase
          .from("organizations")
          .update({
            player_photos_purge_at: desiredPurgeAt,
            player_photos_purged_at: null
          })
          .eq("id", organization.id);
        if (scheduleError) throw new Error(scheduleError.message);
        summary.scheduledOrganizations += 1;
      }
      continue;
    }

    const shouldPurgeNow = !organization.player_photos_purged_at;
    let nextPurgedAt = organization.player_photos_purged_at ?? null;

    if (shouldPurgeNow) {
      const playerIds = activity.players.map((player) => player.id);
      if (playerIds.length) {
        const objectPaths = playerIds.map((playerId) =>
          getOrganizationPlayerPhotoObjectPath(params.schemaName, organization.id, playerId)
        );

        const { error: removeError } = await params.supabase.storage
          .from(params.bucketName)
          .remove(objectPaths);
        if (removeError) throw new Error(removeError.message);

        const { error: deleteEventsError } = await params.supabase
          .from("player_photo_upload_events")
          .delete()
          .eq("target_type", "organization_player")
          .in("target_player_id", playerIds);
        if (deleteEventsError) throw new Error(deleteEventsError.message);

        summary.deletedPlayerPhotos += objectPaths.length;
        summary.clearedUploadEvents += playerIds.length;
      }

      nextPurgedAt = now.toISOString();
      summary.purgedOrganizations += 1;
    } else if (organization.player_photos_purge_at !== desiredPurgeAt) {
      summary.scheduledOrganizations += 1;
    }

    if (
      organization.player_photos_purge_at !== desiredPurgeAt ||
      organization.player_photos_purged_at !== nextPurgedAt
    ) {
      const { error: updateError } = await params.supabase
        .from("organizations")
        .update({
          player_photos_purge_at: desiredPurgeAt,
          player_photos_purged_at: nextPurgedAt
        })
        .eq("id", organization.id);
      if (updateError) throw new Error(updateError.message);
    }
  }

  return summary;
}
