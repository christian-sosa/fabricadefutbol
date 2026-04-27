import { beforeEach, describe, expect, it, vi } from "vitest";

const { createSupabaseServerClientMock } = vi.hoisted(() => ({
  createSupabaseServerClientMock: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock
}));

import { getAdminDashboardData, getAdminPlayers, getSelectablePlayers } from "@/lib/queries/admin";
import { createFakeSupabase } from "../helpers/fake-supabase";

const ORG_ID = "org-1";

describe("admin player queries", () => {
  beforeEach(() => {
    createSupabaseServerClientMock.mockReset();
  });

  it("ordena la planilla por nivel y usa display_order solo como desempate", async () => {
    const fake = createFakeSupabase({
      players: [
        {
          id: "player-level-3",
          organization_id: ORG_ID,
          full_name: "Nivel Tres",
          initial_rank: 1,
          skill_level: 3,
          display_order: 1
        },
        {
          id: "player-level-2",
          organization_id: ORG_ID,
          full_name: "Nivel Dos",
          initial_rank: 2,
          skill_level: 2,
          display_order: 9
        },
        {
          id: "player-level-1",
          organization_id: ORG_ID,
          full_name: "Nivel Uno",
          initial_rank: 3,
          skill_level: 1,
          display_order: 8
        }
      ]
    });
    createSupabaseServerClientMock.mockResolvedValue(fake.client);

    const players = await getAdminPlayers(ORG_ID);

    expect(players.map((player) => player.id)).toEqual([
      "player-level-1",
      "player-level-2",
      "player-level-3"
    ]);
  });

  it("ordena los convocables con el mismo criterio que la planilla admin", async () => {
    const fake = createFakeSupabase({
      players: [
        {
          id: "player-inactive",
          organization_id: ORG_ID,
          full_name: "Inactivo",
          initial_rank: 1,
          skill_level: 1,
          display_order: 1,
          active: false
        },
        {
          id: "player-level-4",
          organization_id: ORG_ID,
          full_name: "Nivel Cuatro",
          initial_rank: 2,
          skill_level: 4,
          display_order: 1
        },
        {
          id: "player-level-2",
          organization_id: ORG_ID,
          full_name: "Nivel Dos",
          initial_rank: 3,
          skill_level: 2,
          display_order: 10
        }
      ]
    });
    createSupabaseServerClientMock.mockResolvedValue(fake.client);

    const players = await getSelectablePlayers(ORG_ID);

    expect(players.map((player) => player.id)).toEqual(["player-level-2", "player-level-4"]);
  });

  it("devuelve conteos de onboarding y partidos del dashboard admin", async () => {
    const fake = createFakeSupabase({
      players: [
        { id: "player-1", organization_id: ORG_ID, full_name: "Activo", active: true },
        { id: "player-2", organization_id: ORG_ID, full_name: "Inactivo", active: false },
        { id: "player-other", organization_id: "org-2", full_name: "Otro", active: true }
      ],
      matches: [
        { id: "draft-1", organization_id: ORG_ID, status: "draft", scheduled_at: "2026-04-01T20:00:00Z" },
        { id: "confirmed-1", organization_id: ORG_ID, status: "confirmed", scheduled_at: "2026-04-02T20:00:00Z" },
        { id: "finished-1", organization_id: ORG_ID, status: "finished", scheduled_at: "2026-04-03T20:00:00Z" },
        { id: "other-1", organization_id: "org-2", status: "finished", scheduled_at: "2026-04-04T20:00:00Z" }
      ]
    });
    createSupabaseServerClientMock.mockResolvedValue(fake.client);

    const dashboard = await getAdminDashboardData(ORG_ID);

    expect(dashboard).toMatchObject({
      draftsCount: 1,
      confirmedCount: 1,
      finishedCount: 1,
      playersCount: 1
    });
    expect(dashboard.latestMatches.map((match) => match.id)).toEqual([
      "finished-1",
      "confirmed-1",
      "draft-1"
    ]);
  });
});
