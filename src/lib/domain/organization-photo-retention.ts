import { resolveOrganizationWriteWindow } from "@/lib/domain/billing";
import { getOrganizationPlayerPhotoObjectPath } from "@/lib/player-photos";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type DbClient =
  | Awaited<ReturnType<typeof createSupabaseServerClient>>
  | NonNullable<ReturnType<typeof createSupabaseAdminClient>>;

type OrganizationRetentionRow = {
  id: string;
  created_at: string;
  player_photos_purge_at: string | null;
  player_photos_purged_at: string | null;
};

type OrganizationSubscriptionRow = {
  organization_id: string;
  status: string | null;
  current_period_end: string | null;
};

type OrganizationPlayerRow = {
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

  const [{ data: organizations, error: organizationsError }, { data: subscriptions, error: subscriptionsError }] =
    await Promise.all([
      params.supabase
        .from("organizations")
        .select("id, created_at, player_photos_purge_at, player_photos_purged_at"),
      params.supabase
        .from("organization_billing_subscriptions")
        .select("organization_id, status, current_period_end")
    ]);

  if (organizationsError) throw new Error(organizationsError.message);
  if (subscriptionsError) throw new Error(subscriptionsError.message);

  const organizationsList = (organizations ?? []) as OrganizationRetentionRow[];
  const subscriptionsByOrganization = new Map<string, OrganizationSubscriptionRow>(
    ((subscriptions ?? []) as OrganizationSubscriptionRow[]).map((row) => [row.organization_id, row])
  );

  summary.scannedOrganizations = organizationsList.length;

  for (const organization of organizationsList) {
    const writeWindow = resolveOrganizationWriteWindow({
      organizationCreatedAt: organization.created_at,
      subscription: subscriptionsByOrganization.get(organization.id) ?? null
    });

    if (writeWindow.canWrite) {
      if (organization.player_photos_purge_at || organization.player_photos_purged_at) {
        const { error: resetError } = await params.supabase
          .from("organizations")
          .update({
            player_photos_purge_at: null,
            player_photos_purged_at: null
          })
          .eq("id", organization.id);
        if (resetError) throw new Error(resetError.message);
        summary.resetOrganizations += 1;
      }
      continue;
    }

    const desiredPurgeAt = writeWindow.playerPhotosPurgeAt;
    if (!desiredPurgeAt) {
      continue;
    }

    const shouldPurgeNow =
      !organization.player_photos_purged_at &&
      new Date(desiredPurgeAt).getTime() <= now.getTime();

    const nextPurgeAt = desiredPurgeAt;
    let nextPurgedAt = organization.player_photos_purged_at ?? null;

    if (shouldPurgeNow) {
      const { data: players, error: playersError } = await params.supabase
        .from("players")
        .select("id")
        .eq("organization_id", organization.id);
      if (playersError) throw new Error(playersError.message);

      const playerIds = ((players ?? []) as OrganizationPlayerRow[]).map((player) => player.id);
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
      organization.player_photos_purge_at !== nextPurgeAt ||
      organization.player_photos_purged_at !== nextPurgedAt
    ) {
      const { error: updateError } = await params.supabase
        .from("organizations")
        .update({
          player_photos_purge_at: nextPurgeAt,
          player_photos_purged_at: nextPurgedAt
        })
        .eq("id", organization.id);
      if (updateError) throw new Error(updateError.message);
    }
  }

  return summary;
}
