import type { MatchHistoryItem, OrganizationMatchesResponse } from "@/lib/query/types";
import type { PlayerComputedStats } from "@/types/domain";
import { rankPlayers } from "@/lib/domain/player-ranking";
import { isPlayerAbsent } from "@/lib/domain/player-activity";

export const ORGANIZATION_PUBLIC_SNAPSHOT_TTL_MS = 10 * 60 * 1000;

export type OrganizationPublicSummary = {
  totalPlayers: number;
  totalFinishedMatches: number;
  upcomingMatches: Array<{
    id: string;
    scheduled_at: string;
    modality: string;
    status: string;
  }>;
  topPlayers: Array<{
    id: string;
    full_name: string;
    photo_path?: string | null;
    photo_updated_at?: string | null;
    current_rating: number;
    initial_rank: number;
    skill_level?: number;
    display_order?: number;
  }>;
};

export type OrganizationPublicSnapshotPayload = {
  summary: OrganizationPublicSummary;
  standings: PlayerComputedStats[];
  matchHistory: MatchHistoryItem[];
};

type QueryError = {
  message: string;
  code?: string;
};

type SnapshotRow = {
  summary?: unknown;
  standings?: unknown;
  match_history?: unknown;
  refreshed_at?: string | null;
  source_revision?: unknown;
  sporting_revision?: unknown;
};

type SnapshotReadQuery = {
  eq(column: string, value: unknown): SnapshotReadQuery;
  is(column: string, value: null): SnapshotReadQuery;
  maybeSingle(): Promise<{ data: SnapshotRow | null; error: QueryError | null }>;
};
type SnapshotDbClient = {
  from(table: string): {
    select(columns?: string): SnapshotReadQuery;
  };
  rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: QueryError | null }>;
};

function normalizeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizeSummary(value: unknown): OrganizationPublicSummary | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<OrganizationPublicSummary>;

  if (
    typeof candidate.totalPlayers !== "number" ||
    typeof candidate.totalFinishedMatches !== "number" ||
    !Array.isArray(candidate.upcomingMatches) ||
    !Array.isArray(candidate.topPlayers)
  ) {
    return null;
  }

  return candidate as OrganizationPublicSummary;
}

export function isOrganizationSnapshotSchemaMissing(error: QueryError | null | undefined) {
  if (!error || !/organization_public_snapshots|write_group_public_snapshot|sporting_revision|source_revision|summary|standings|match_history/i.test(error.message)) return false;
  if (error.code) return ["42P01", "42703", "PGRST205", "PGRST202"].includes(error.code);
  return /(?:relation|column|function)\b.*\bdoes not exist\b|could not find\b.*\bschema cache\b/i.test(error.message);
}

function normalizeRevision(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !/^\d+$/.test(value))) return null;
  const revision = Number(value);
  return Number.isSafeInteger(revision) && revision >= 0 ? revision : null;
}

function publicStandings(value: unknown) {
  return rankPlayers(normalizeArray<PlayerComputedStats>(value).map((player) => ({
    ...player,
    isInjured: false,
    isAbsent: isPlayerAbsent({ isInjured: false, matchesSinceLastPlayed: player.matchesSinceLastPlayed ?? 0, lastPlayedAt: player.lastPlayedAt ?? null })
  })));
}

export async function readOrganizationSportingRevision(supabase: unknown, organizationId: string): Promise<number | null> {
  const { data, error } = await (supabase as SnapshotDbClient).from("organizations")
    .select("sporting_revision").eq("id", organizationId).eq("is_public", true).is("archived_at", null).maybeSingle();
  if (isOrganizationSnapshotSchemaMissing(error)) return null;
  if (error) throw new Error(error.message);
  return data ? normalizeRevision(data.sporting_revision) : null;
}

export function buildOrganizationPublicSnapshotPayload(params: OrganizationPublicSnapshotPayload) {
  return {
    summary: params.summary,
    standings: publicStandings(params.standings),
    matchHistory: params.matchHistory
  } satisfies OrganizationPublicSnapshotPayload;
}

async function readSnapshotRow(
  supabase: unknown,
  organizationId: string,
  columns: string
): Promise<SnapshotRow | null> {
  const client = supabase as SnapshotDbClient;
  const { data, error } = await client
    .from("organization_public_snapshots")
    .select(`${columns}, source_revision, refreshed_at`)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (isOrganizationSnapshotSchemaMissing(error)) return null;
  if (error) throw new Error(error.message);
  if (!data) return null;
  const refreshedAt = Date.parse(data.refreshed_at ?? "");
  const age = Date.now() - refreshedAt;
  if (!Number.isFinite(age) || age < 0 || age >= ORGANIZATION_PUBLIC_SNAPSHOT_TTL_MS) return null;
  // Read the live revision after the snapshot: a mutation during its read invalidates it.
  const revision = await readOrganizationSportingRevision(supabase, organizationId);
  return revision !== null && normalizeRevision(data.source_revision) === revision ? data : null;
}

export async function readOrganizationPublicSummarySnapshot(
  supabase: unknown,
  organizationId: string
): Promise<OrganizationPublicSummary | null> {
  const data = await readSnapshotRow(supabase, organizationId, "summary");
  return data ? normalizeSummary(data.summary) : null;
}

export async function readOrganizationPublicStandingsSnapshot(
  supabase: unknown,
  organizationId: string
): Promise<PlayerComputedStats[] | null> {
  const data = await readSnapshotRow(supabase, organizationId, "standings");
  return data && Array.isArray(data.standings) ? publicStandings(data.standings) : null;
}

export async function readOrganizationPublicMatchHistorySnapshot(
  supabase: unknown,
  organizationId: string
): Promise<MatchHistoryItem[] | null> {
  const data = await readSnapshotRow(supabase, organizationId, "match_history");
  return data && Array.isArray(data.match_history) ? normalizeArray<MatchHistoryItem>(data.match_history) : null;
}

export async function readOrganizationPublicSnapshot(
  supabase: unknown,
  organizationId: string
): Promise<OrganizationPublicSnapshotPayload | null> {
  const data = await readSnapshotRow(supabase, organizationId, "summary, standings, match_history");
  if (!data) return null;
  const summary = normalizeSummary(data.summary);
  if (!summary) return null;

  return {
    summary,
    standings: publicStandings(data.standings),
    matchHistory: normalizeArray<MatchHistoryItem>(data.match_history)
  };
}

export async function writeOrganizationPublicSnapshot(
  supabase: unknown,
  organizationId: string,
  payload: OrganizationPublicSnapshotPayload,
  expectedRevision: number
) {
  if (normalizeRevision(expectedRevision) === null) return false;
  const client = supabase as SnapshotDbClient;
  const { data, error } = await client.rpc("write_group_public_snapshot", {
    p_organization_id: organizationId,
    p_expected_revision: expectedRevision,
    p_payload: buildOrganizationPublicSnapshotPayload(payload)
  });

  if (isOrganizationSnapshotSchemaMissing(error)) return false;
  if (error) throw new Error(error.message);
  return data === true;
}

export function buildSnapshotMatchHistoryPage(params: {
  organizationId: string | null;
  matchHistory: MatchHistoryItem[];
  page: number;
  pageSize: number;
}): OrganizationMatchesResponse {
  const totalCount = params.matchHistory.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / params.pageSize));
  const safePage = Math.max(1, params.page);
  const from = (safePage - 1) * params.pageSize;
  const to = from + params.pageSize;

  return {
    organizationId: params.organizationId,
    matches: params.matchHistory.slice(from, to),
    pagination: {
      page: safePage,
      pageSize: params.pageSize,
      totalCount,
      totalPages,
      hasNextPage: safePage < totalPages,
      hasPreviousPage: safePage > 1
    }
  };
}
