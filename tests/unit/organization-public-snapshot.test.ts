import { describe, expect, it } from "vitest";

import {
  buildSnapshotMatchHistoryPage,
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
      goals: 3,
      assists: 1
    }
  ],
  matchHistory
};

describe("organization public snapshot helpers", () => {
  it("guarda y lee el snapshot publico desde Supabase", async () => {
    const fake = createFakeSupabase();

    await expect(writeOrganizationPublicSnapshot(fake.client as never, "org-1", payload)).resolves.toBe(true);

    expect(fake.find("organization_public_snapshots", (row) => row.organization_id === "org-1")).toMatchObject({
      organization_id: "org-1",
      match_history_total_count: 3
    });
    await expect(readOrganizationPublicSnapshot(fake.client as never, "org-1")).resolves.toEqual(payload);
  });

  it("pagina el historial cacheado sin consultar tablas base", () => {
    const response = buildSnapshotMatchHistoryPage({
      organizationId: "org-1",
      matchHistory,
      page: 2,
      pageSize: 2
    });

    expect(response.matches).toEqual([matchHistory[2]]);
    expect(response.pagination).toEqual({
      page: 2,
      pageSize: 2,
      totalCount: 3,
      totalPages: 2,
      hasNextPage: false,
      hasPreviousPage: true
    });
  });

  it("ignora filas incompletas para poder caer al calculo en vivo", async () => {
    const fake = createFakeSupabase({
      organization_public_snapshots: [
        {
          organization_id: "org-empty"
        }
      ]
    });

    await expect(readOrganizationPublicSummarySnapshot(fake.client, "org-empty")).resolves.toBeNull();
    await expect(readOrganizationPublicSnapshot(fake.client, "org-empty")).resolves.toBeNull();
  });

  it("tolera despliegues donde la tabla todavia no existe", () => {
    expect(isOrganizationSnapshotSchemaMissing({ message: 'relation "organization_public_snapshots" does not exist' })).toBe(
      true
    );
    expect(isOrganizationSnapshotSchemaMissing({ message: "otra falla de permisos" })).toBe(false);
    expect(isOrganizationSnapshotSchemaMissing(null)).toBe(false);
  });
});
