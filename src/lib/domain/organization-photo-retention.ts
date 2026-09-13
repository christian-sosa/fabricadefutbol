import { ORGANIZATION_PLAYER_PHOTO_RETENTION_DAYS } from "@/lib/constants";
import { isOrganizationPlayerPhotoObjectPath } from "@/lib/player-photos";
import { readAllRows } from "@/lib/queries/read-all-rows";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type DbClient = Awaited<ReturnType<typeof createSupabaseServerClient>> | NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
type ActivityRow = { created_at?: string | null; updated_at?: string | null; photo_updated_at?: string | null };
type OrganizationRetentionRow = {
  id: string;
  created_at: string;
  player_photos_purge_at: string | null;
  player_photos_purged_at: string | null;
};
type PlayerRow = ActivityRow & { id: string; photo_path: string | null };
export type OrganizationPhotoRetentionSummary = {
  scannedOrganizations: number;
  scheduledOrganizations: number;
  purgedOrganizations: number;
  deletedPlayerPhotos: number;
  clearedUploadEvents: number;
  resetOrganizations: number;
};

function latestActivity(organization: OrganizationRetentionRow, rows: ActivityRow[]) {
  let latest = Date.parse(organization.created_at);
  for (const row of rows) {
    for (const value of [row.created_at, row.updated_at, row.photo_updated_at]) {
      if (value && Number.isFinite(Date.parse(value))) latest = Math.max(latest, Date.parse(value));
    }
  }
  return new Date(latest).toISOString();
}

async function activityFor(supabase: DbClient, organization: OrganizationRetentionRow) {
  const [{ data: players, error: playerError }, { data: matches, error: matchError }] = await Promise.all([
    readAllRows((from, to) => supabase.from("players")
      .select("id, created_at, updated_at, photo_path, photo_updated_at", { count: "exact" })
      .eq("organization_id", organization.id).order("id").range(from, to)),
    supabase.from("matches").select("created_at, updated_at").eq("organization_id", organization.id).order("updated_at", { ascending: false }).limit(1)
  ]);
  if (playerError) throw new Error(playerError.message);
  if (matchError) throw new Error(matchError.message);
  const rows = (players ?? []) as PlayerRow[];
  return { players: rows, latest: latestActivity(organization, [...rows, ...(matches ?? [])]) };
}

export async function purgeExpiredOrganizationPlayerPhotos(params: {
  supabase: DbClient;
  bucketName: string;
  schemaName: string;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const summary: OrganizationPhotoRetentionSummary = {
    scannedOrganizations: 0, scheduledOrganizations: 0, purgedOrganizations: 0,
    deletedPlayerPhotos: 0, clearedUploadEvents: 0, resetOrganizations: 0
  };
  const pageSize = 200;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await params.supabase.from("organizations")
      .select("id, created_at, player_photos_purge_at, player_photos_purged_at")
      .order("id", { ascending: true }).range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    const organizations = (data ?? []) as OrganizationRetentionRow[];
    for (const organization of organizations) {
      summary.scannedOrganizations += 1;
      const activity = await activityFor(params.supabase, organization);
      const desiredPurgeAt = new Date(Date.parse(activity.latest) + ORGANIZATION_PLAYER_PHOTO_RETENTION_DAYS * 86_400_000).toISOString();
      if (Date.parse(desiredPurgeAt) > now.getTime()) {
        if (organization.player_photos_purge_at !== desiredPurgeAt || organization.player_photos_purged_at) {
          const { error: updateError } = await params.supabase.from("organizations")
            .update({ player_photos_purge_at: desiredPurgeAt, player_photos_purged_at: null }).eq("id", organization.id);
          if (updateError) throw new Error(updateError.message);
          if (organization.player_photos_purged_at) summary.resetOrganizations += 1;
          else summary.scheduledOrganizations += 1;
        }
        continue;
      }

      const photoPlayers = activity.players.filter((player) => player.photo_path);
      if (organization.player_photos_purged_at && !photoPlayers.length) continue;
      for (const player of photoPlayers) {
        const objectPath = player.photo_path!;
        // Only recorded objects owned by this group can be removed.
        if (!isOrganizationPlayerPhotoObjectPath(objectPath, params.schemaName, organization.id, player.id)) {
          throw new Error("La foto registrada no pertenece al jugador indicado.");
        }
        const { error: removeError } = await params.supabase.storage.from(params.bucketName).remove([objectPath]);
        if (removeError) throw new Error(removeError.message);
        const { error: clearError } = await params.supabase.from("players")
          .update({ photo_path: null }).eq("id", player.id).eq("organization_id", organization.id).eq("photo_path", objectPath);
        if (clearError) throw new Error(clearError.message);
        summary.deletedPlayerPhotos += 1;
        const { data: removedEvents, error: eventsError } = await params.supabase.from("player_photo_upload_events")
          .delete().eq("target_type", "organization_player").eq("target_player_id", player.id)
          .lte("created_at", activity.latest).select("id");
        if (eventsError) throw new Error(eventsError.message);
        summary.clearedUploadEvents += removedEvents?.length ?? 0;
      }
      const { error: snapshotError } = await params.supabase.from("organization_public_snapshots")
        .delete().eq("organization_id", organization.id);
      if (snapshotError) throw new Error(snapshotError.message);
      const { error: markError } = await params.supabase.from("organizations")
        .update({ player_photos_purge_at: desiredPurgeAt, player_photos_purged_at: now.toISOString() })
        .eq("id", organization.id);
      if (markError) throw new Error(markError.message);
      summary.purgedOrganizations += 1;
    }
    if (organizations.length < pageSize) break;
  }
  return summary;
}
