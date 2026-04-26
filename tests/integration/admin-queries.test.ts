import { beforeEach, describe, expect, it, vi } from "vitest";

const { createSupabaseServerClientMock } = vi.hoisted(() => ({
  createSupabaseServerClientMock: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock
}));

import { getAdminPlayers, getSelectablePlayers } from "@/lib/queries/admin";
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
});
