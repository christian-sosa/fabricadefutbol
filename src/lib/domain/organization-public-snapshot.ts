import type { MatchHistoryItem, OrganizationMatchesResponse } from "@/lib/query/types";
import type { PlayerComputedStats } from "@/types/domain";

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
    current_rating: number;
    initial_rank: number;
  }>;
};

export type OrganizationPublicSnapshotPayload = {
  summary: OrganizationPublicSummary;
  standings: PlayerComputedStats[];
  matchHistory: MatchHistoryItem[];
};

type QueryError = {
  message: string;
};

type SnapshotRow = {
  summary?: unknown;
  standings?: unknown;
  match_history?: unknown;
  refreshed_at?: string | null;
};

type SnapshotDbClient = {
  from(table: string): {
    select(columns?: string): {
      eq(column: string, value: unknown): {
        maybeSingle(): Promise<{
          data: SnapshotRow | null;
          error: QueryError | null;
        }>;
      };
    };
    upsert(
      value: Record<string, unknown>,
      options?: { onConflict?: string }
    ): Promise<{
      error: QueryError | null;
    }>;
  };
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
  return Boolean(error?.message && /organization_public_snapshots|summary|standings|match_history/i.test(error.message));
}

export function buildOrganizationPublicSnapshotPayload(params: OrganizationPublicSnapshotPayload) {
  return {
    summary: params.summary,
    standings: params.standings,
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
    .select(columns)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (isOrganizationSnapshotSchemaMissing(error)) return null;
  if (error) throw new Error(error.message);
  return data;
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
  return data ? normalizeArray<PlayerComputedStats>(data.standings) : null;
}

export async function readOrganizationPublicMatchHistorySnapshot(
  supabase: unknown,
  organizationId: string
): Promise<MatchHistoryItem[] | null> {
  const data = await readSnapshotRow(supabase, organizationId, "match_history");
  return data ? normalizeArray<MatchHistoryItem>(data.match_history) : null;
}

export async function readOrganizationPublicSnapshot(
  supabase: unknown,
  organizationId: string
): Promise<OrganizationPublicSnapshotPayload | null> {
  const data = await readSnapshotRow(supabase, organizationId, "summary, standings, match_history, refreshed_at");
  if (!data) return null;
  const summary = normalizeSummary(data.summary);
  if (!summary) return null;

  return {
    summary,
    standings: normalizeArray<PlayerComputedStats>(data.standings),
    matchHistory: normalizeArray<MatchHistoryItem>(data.match_history)
  };
}

export async function writeOrganizationPublicSnapshot(
  supabase: unknown,
  organizationId: string,
  payload: OrganizationPublicSnapshotPayload
) {
  const client = supabase as SnapshotDbClient;
  const { error } = await client.from("organization_public_snapshots").upsert(
    {
      organization_id: organizationId,
      summary: payload.summary,
      standings: payload.standings,
      match_history: payload.matchHistory,
      match_history_total_count: payload.matchHistory.length,
      refreshed_at: new Date().toISOString()
    },
    { onConflict: "organization_id" }
  );

  if (isOrganizationSnapshotSchemaMissing(error)) return false;
  if (error) throw new Error(error.message);
  return true;
}

export function buildSnapshotMatchHistoryPage(params: {
  organizationId: string | null;
  matchHistory: MatchHistoryItem[];
  page: number;
  pageSize: number;
}): OrganizationMatchesResponse {
  const totalCount = params.matchHistory.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / params.pageSize));
  const safePage = Math.min(Math.max(1, params.page), totalPages);
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
