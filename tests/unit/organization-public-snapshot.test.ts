import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildSnapshotMatchHistoryPage,
  buildOrganizationPublicSnapshotPayload,
  ORGANIZATION_PUBLIC_SNAPSHOT_TTL_MS,
  readOrganizationSportingRevision,
  isOrganizationSnapshotSchemaMissing,
  readOrganizationPublicSnapshot,
  readOrganizationPublicSummarySnapshot,
  writeOrganizationPublicSnapshot,
  type OrganizationPublicSnapshotPayload
} from "@/lib/domain/organization-public-snapshot";
import type { MatchHistoryItem } from "@/lib/query/types";
import { createFakeSupabase } from "../helpers/fake-supabase";

const matchHistory: MatchHistoryItem[] = [
  {
    id: "match-1",
    scheduledAt: "2026-03-20T20:00:00.000Z",
    modality: "7v7",
    status: "finished",
    scoreA: 3,
    scoreB: 1,
    winnerTeam: "A"
  },
  {
    id: "match-2",
    scheduledAt: "2026-03-13T20:00:00.000Z",
    modality: "7v7",
    status: "finished",
    scoreA: 2,
    scoreB: 2,
    winnerTeam: "DRAW"
  },
  {
    id: "match-3",
    scheduledAt: "2026-03-06T20:00:00.000Z",
    modality: "7v7",
    status: "cancelled",
    scoreA: null,
    scoreB: null,
    winnerTeam: null
  }
];

const payload: OrganizationPublicSnapshotPayload = {
  summary: {
    totalPlayers: 12,
    totalFinishedMatches: 2,
    upcomingMatches: [
      {
        id: "match-4",
        scheduled_at: "2026-03-27T20:00:00.000Z",
        modality: "7v7",
        status: "confirmed"
      }
    ],
    topPlayers: [
      {
        id: "player-1",
        full_name: "Nico Perez",
        current_rating: 1140,
        initial_rank: 1
      }
    ]
  },
  standings: [
    {
      playerId: "player-1",
      playerName: "Nico Perez",
      currentRating: 1140,
      initialRank: 1,
      currentRank: 1,
      matchesPlayed: 2,
      wins: 2,
      draws: 0,
      losses: 0,
      winRate: 100,
      streak: "2G",
      recentResults: ["V", "V"],
      goals: 3,
      assists: 1
    }
  ],
  matchHistory
};

const NOW = new Date("2026-09-30T12:00:00Z");
function snapshotFixture(overrides: Record<string, unknown> = {}, organization: Record<string, unknown> = {}) {
  return createFakeSupabase({
    organizations: [{ id: "org-1", is_public: true, archived_at: null, sporting_revision: 7, ...organization }],
    organization_public_snapshots: [{ organization_id: "org-1", summary: payload.summary, standings: payload.standings,
      match_history: payload.matchHistory, source_revision: 7, refreshed_at: NOW.toISOString(), ...overrides }]
  });
}

describe("organization public snapshot helpers", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
  afterEach(() => vi.useRealTimers());

  it("ranks an eligible snapshot using MVP before matches played", async () => {
    const fake = snapshotFixture({ standings: [
      { ...payload.standings[0], matchesPlayed: 20, mvpCount: 0 },
      { ...payload.standings[0], playerId: "player-2", playerName: "Beto", currentRank: 2, matchesPlayed: 1, mvpCount: 2 }
    ] });
    const snapshot = await readOrganizationPublicSnapshot(fake.client, "org-1");
    expect(snapshot?.standings.map((player) => [player.playerId, player.currentRank, player.currentRating])).toEqual([
      ["player-2", 1, 1140], ["player-1", 2, 1140]
    ]);
  });

  it("writes only through the revision-checked RPC and reads matching snapshots", async () => {
    const fake = snapshotFixture();
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const client = { ...fake.client, rpc };
    await expect(writeOrganizationPublicSnapshot(client, "org-1", payload, 7)).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("write_group_public_snapshot", {
      p_organization_id: "org-1", p_expected_revision: 7, p_payload: buildOrganizationPublicSnapshotPayload(payload)
    });
    await expect(readOrganizationPublicSnapshot(client, "org-1")).resolves.toEqual(buildOrganizationPublicSnapshotPayload(payload));
  });

  it("returns false when a concurrent mutation rejects the snapshot CAS", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    await expect(writeOrganizationPublicSnapshot({ rpc }, "org-1", payload, 7)).resolves.toBe(false);
  });

  it("does not issue a write with an invalid expected revision", async () => {
    const rpc = vi.fn();
    await expect(writeOrganizationPublicSnapshot({ rpc }, "org-1", payload, -1)).resolves.toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([6, null, -1, "9007199254740992"])("rejects mismatched or invalid source revision %s", async (source_revision) => {
    const fake = snapshotFixture({ source_revision });
    await expect(readOrganizationPublicSnapshot(fake.client, "org-1")).resolves.toBeNull();
  });

  it("accepts the same revision represented as a bigint string", async () => {
    const fake = snapshotFixture({ source_revision: "7" }, { sporting_revision: "7" });
    await expect(readOrganizationPublicSnapshot(fake.client, "org-1")).resolves.toMatchObject({ summary: payload.summary });
  });

  it.each([
    new Date(NOW.getTime() - ORGANIZATION_PUBLIC_SNAPSHOT_TTL_MS).toISOString(),
    new Date(NOW.getTime() + 1).toISOString(),
    "invalid"
  ])("rejects an expired, future or invalid refresh timestamp %s", async (refreshed_at) => {
    const fake = snapshotFixture({ refreshed_at });
    await expect(readOrganizationPublicSnapshot(fake.client, "org-1")).resolves.toBeNull();
  });

  it("accepts a snapshot immediately before its ten-minute expiry", async () => {
    const fake = snapshotFixture({ refreshed_at: new Date(NOW.getTime() - ORGANIZATION_PUBLIC_SNAPSHOT_TTL_MS + 1).toISOString() });
    await expect(readOrganizationPublicSnapshot(fake.client, "org-1")).resolves.toMatchObject({ summary: payload.summary });
  });

  it.each([{ archived_at: NOW.toISOString() }, { is_public: false }])("rejects a snapshot of an inaccessible group", async (organization) => {
    const fake = snapshotFixture({}, organization);
    await expect(readOrganizationPublicSnapshot(fake.client, "org-1")).resolves.toBeNull();
  });

  it("masks health fields from older persisted standings", async () => {
    const fake = snapshotFixture({ standings: [{ ...payload.standings[0], isInjured: true, isAbsent: false, lastPlayedAt: null }] });
    const snapshot = await readOrganizationPublicSnapshot(fake.client, "org-1");
    expect(snapshot?.standings[0]).toMatchObject({ isInjured: false, isAbsent: true });
  });

  it("paginates the cached history", () => {
    const response = buildSnapshotMatchHistoryPage({ organizationId: "org-1", matchHistory, page: 2, pageSize: 2 });
    expect(response.matches).toEqual([matchHistory[2]]);
    expect(response.pagination).toEqual({ page: 2, pageSize: 2, totalCount: 3, totalPages: 2, hasNextPage: false, hasPreviousPage: true });
  });

  it("ignores incomplete summary rows", async () => {
    const fake = snapshotFixture({ summary: {} });
    await expect(readOrganizationPublicSummarySnapshot(fake.client, "org-1")).resolves.toBeNull();
    await expect(readOrganizationPublicSnapshot(fake.client, "org-1")).resolves.toBeNull();
  });

  it.each([
    { message: 'relation "organization_public_snapshots" does not exist' },
    { message: 'column organizations.sporting_revision does not exist', code: "42703" },
    { message: 'Could not find the function write_group_public_snapshot in the schema cache', code: "PGRST202" },
    { message: 'Could not find the table organization_public_snapshots in the schema cache', code: "PGRST205" }
  ])("recognizes a missing additive schema object", (error) => {
    expect(isOrganizationSnapshotSchemaMissing(error)).toBe(true);
  });

  it.each([
    { message: "permission denied for table organization_public_snapshots", code: "42501" },
    { message: "permission denied for table organization_public_snapshots" },
    { message: "statement timeout while reading standings", code: "57014" },
    { message: "summary rejected by write_group_public_snapshot" },
    { message: 'relation "unrelated_table" does not exist', code: "42P01" }
  ])("does not hide unrelated or operational failures", (error) => {
    expect(isOrganizationSnapshotSchemaMissing(error)).toBe(false);
  });

  it("propagates read and write permission errors mentioning snapshot objects", async () => {
    const error = { message: "permission denied for organization_public_snapshots", code: "42501" };
    const query = { eq: () => query, maybeSingle: vi.fn().mockResolvedValue({ data: null, error }) };
    await expect(readOrganizationPublicSummarySnapshot({ from: () => ({ select: () => query }) }, "org-1")).rejects.toThrow(error.message);
    await expect(writeOrganizationPublicSnapshot({ rpc: () => Promise.resolve({ data: null, error }) }, "org-1", payload, 7)).rejects.toThrow(error.message);
    const revisionError = { ...error, message: "permission denied for sporting_revision" };
    const revisionQuery = { eq: () => revisionQuery, is: () => revisionQuery, maybeSingle: vi.fn().mockResolvedValue({ data: null, error: revisionError }) };
    await expect(readOrganizationSportingRevision({ from: () => ({ select: () => revisionQuery }) }, "org-1")).rejects.toThrow(revisionError.message);
  });
});
