import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type DbClient =
  | Awaited<ReturnType<typeof createSupabaseServerClient>>
  | NonNullable<ReturnType<typeof createSupabaseAdminClient>>;

type IdRow = {
  id: string;
};

function collectIds(rows: Array<{ id?: unknown }> | null | undefined) {
  return (rows ?? [])
    .map((row) => (row.id == null ? null : String(row.id)))
    .filter((value): value is string => Boolean(value));
}

function chunkValues<T>(values: T[], size = 200) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function deleteByIds(params: {
  supabase: DbClient;
  table:
    | "match_player_stats"
    | "rating_history"
    | "match_players"
    | "team_option_players"
    | "team_option_guests"
    | "team_options"
    | "match_result"
    | "match_guests";
  column: "match_id" | "player_id" | "team_option_id";
  ids: string[];
}) {
  const { supabase, table, column, ids } = params;
  if (!ids.length) return;

  for (const chunk of chunkValues(ids)) {
    const { error } = await supabase.from(table).delete().in(column, chunk);
    if (error) throw new Error(error.message);
  }
}

async function clearOrganizationReferenceFromCreationPayments(params: {
  supabase: DbClient;
  organizationId: string;
}) {
  const { supabase, organizationId } = params;
  const { error } = await supabase
    .from("organization_billing_payments")
    .update({
      created_organization_id: null
    })
    .eq("created_organization_id", organizationId);
  if (error) throw new Error(error.message);
}

async function deletePlayerPhotoObjects(params: {
  supabase: DbClient;
  organizationId: string;
  playerIds: string[];
  bucketName: string | null | undefined;
  schemaName: string | null | undefined;
}) {
  const { supabase, organizationId, playerIds, bucketName, schemaName } = params;
  if (!bucketName || !schemaName || !playerIds.length) return;

  const currentPaths = playerIds.map((playerId) => `${schemaName}/${organizationId}/${playerId}.webp`);
  const legacyPaths = playerIds.map((playerId) => `${organizationId}/${playerId}.webp`);

  for (const pathChunk of [...chunkValues(currentPaths), ...chunkValues(legacyPaths)]) {
    const { error } = await supabase.storage.from(bucketName).remove(pathChunk);
    if (error) {
      console.error("[organization-workflow] storage cleanup failed", {
        organizationId,
        bucketName,
        message: error.message
      });
    }
  }
}

export async function deleteOrganizationDeep(params: {
  supabase: DbClient;
  organizationId: string;
  playerPhotosBucket?: string | null;
  schemaName?: string | null;
}) {
  const { supabase, organizationId, playerPhotosBucket, schemaName } = params;

  const [playersResult, matchesResult] = await Promise.all([
    supabase.from("players").select("id").eq("organization_id", organizationId),
    supabase.from("matches").select("id").eq("organization_id", organizationId)
  ]);

  if (playersResult.error) throw new Error(playersResult.error.message);
  if (matchesResult.error) throw new Error(matchesResult.error.message);

  const playerIds = collectIds(playersResult.data as IdRow[]);
  const matchIds = collectIds(matchesResult.data as IdRow[]);

  let teamOptionIds: string[] = [];
  if (matchIds.length) {
    const { data, error } = await supabase.from("team_options").select("id").in("match_id", matchIds);
    if (error) throw new Error(error.message);
    teamOptionIds = collectIds(data as IdRow[]);
  }

  await deleteByIds({
    supabase,
    table: "match_player_stats",
    column: "match_id",
    ids: matchIds
  });
  await deleteByIds({
    supabase,
    table: "rating_history",
    column: "match_id",
    ids: matchIds
  });
  await deleteByIds({
    supabase,
    table: "match_players",
    column: "match_id",
    ids: matchIds
  });
  await deleteByIds({
    supabase,
    table: "team_option_players",
    column: "team_option_id",
    ids: teamOptionIds
  });
  await deleteByIds({
    supabase,
    table: "team_option_guests",
    column: "team_option_id",
    ids: teamOptionIds
  });
  await deleteByIds({
    supabase,
    table: "match_player_stats",
    column: "player_id",
    ids: playerIds
  });
  await deleteByIds({
    supabase,
    table: "rating_history",
    column: "player_id",
    ids: playerIds
  });
  await deleteByIds({
    supabase,
    table: "match_players",
    column: "player_id",
    ids: playerIds
  });
  await deleteByIds({
    supabase,
    table: "team_option_players",
    column: "player_id",
    ids: playerIds
  });
  await deleteByIds({
    supabase,
    table: "match_result",
    column: "match_id",
    ids: matchIds
  });
  await deleteByIds({
    supabase,
    table: "match_guests",
    column: "match_id",
    ids: matchIds
  });
  await deleteByIds({
    supabase,
    table: "team_options",
    column: "match_id",
    ids: matchIds
  });

  await clearOrganizationReferenceFromCreationPayments({
    supabase,
    organizationId
  });

  const organizationScopedTables = [
    "organization_billing_payments",
    "organization_billing_subscriptions",
    "organization_invites",
    "organization_admins",
    "matches",
    "players"
  ] as const;

  for (const table of organizationScopedTables) {
    const { error } = await supabase.from(table).delete().eq("organization_id", organizationId);
    if (error) throw new Error(error.message);
  }

  const { error: deleteOrganizationError } = await supabase
    .from("organizations")
    .delete()
    .eq("id", organizationId);
  if (deleteOrganizationError) throw new Error(deleteOrganizationError.message);

  await deletePlayerPhotoObjects({
    supabase,
    organizationId,
    playerIds,
    bucketName: playerPhotosBucket,
    schemaName
  });

  return {
    deletedOrganizationId: organizationId,
    deletedPlayers: playerIds.length,
    deletedMatches: matchIds.length,
    deletedTeamOptions: teamOptionIds.length
  };
}
