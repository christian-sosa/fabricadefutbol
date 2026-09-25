import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.client }));

import { getAdminMatchSubstitutes, getAdminScorerHistory } from "@/lib/queries/admin-match-extras";
import { createFakeSupabase } from "../helpers/fake-supabase";

function finishedMatch(id: string, overrides: Record<string, unknown> = {}) {
  return { id, organization_id: "group-a", status: "finished", modality: "11v11", scheduled_at: "2026-09-25T19:00:00Z", ...overrides };
}

describe("consultas privadas de suplentes y goleadores", () => {
  beforeEach(() => mocks.client.mockReset());

  it("aísla partidos del grupo y modalidades grandes, ordena estable y limita la página al historial existente", async () => {
    const eligible = Array.from({ length: 22 }, (_, index) => finishedMatch(`match-${String(index).padStart(2, "0")}`));
    const fake = createFakeSupabase({
      matches: [...eligible, finishedMatch("foreign", { organization_id: "group-b" }), finishedMatch("small", { modality: "7v7" }), finishedMatch("draft", { status: "draft" })],
      match_goal_scorers: [
        { match_id: "match-20", participant_id: "player:p20", display_name: "Jugador veinte", team: "A", goals: 2 },
        { match_id: "foreign", participant_id: "player:foreign", display_name: "Ajeno", team: "A", goals: 9 },
        { match_id: "match-00", participant_id: "player:p0", display_name: "Otra página", team: "B", goals: 1 }
      ]
    });
    mocks.client.mockResolvedValue(fake.client);
    const history = await getAdminScorerHistory("group-a", 999999);
    expect(history.page).toBe(2);
    expect(history.pageCount).toBe(2);
    expect(history.matches.map((match) => match.id)).toEqual(["match-20", "match-21"]);
    expect(history.matches[0].scorers).toEqual([expect.objectContaining({ display_name: "Jugador veinte", goals: 2 })]);
    expect(history.matches[1].scorers).toEqual([]);
  });

  it("recupera todos los autores aunque el servidor limite cada respuesta por debajo del tamaño solicitado", async () => {
    const matches = Array.from({ length: 20 }, (_, index) => finishedMatch(`match-${String(index).padStart(2, "0")}`));
    const fake = createFakeSupabase({
      matches,
      match_goal_scorers: matches.flatMap((match) => Array.from({ length: 60 }, (_, index) => ({
        match_id: match.id, participant_id: `player:${String(index).padStart(3, "0")}`, display_name: `Jugador ${index}`, team: "A", goals: 1
      })))
    });
    const from = fake.client.from.bind(fake.client);
    let scorerReads = 0;
    vi.spyOn(fake.client, "from").mockImplementation((table) => {
      const query = from(table);
      if (table === "match_goal_scorers") {
        scorerReads += 1;
        query.limit(200);
      }
      return query;
    });
    mocks.client.mockResolvedValue(fake.client);
    const history = await getAdminScorerHistory("group-a");
    expect(scorerReads).toBe(6);
    expect(history.matches).toHaveLength(20);
    expect(history.matches.every((match) => match.scorers.length === 60)).toBe(true);
    expect(history.matches.flatMap((match) => match.scorers)).toHaveLength(1200);
  });

  it("no presenta un historial vacío cuando falla la lectura de autores", async () => {
    mocks.client.mockResolvedValue(createFakeSupabase({
      matches: [finishedMatch("match-1")],
      queryFailures: { match_goal_scorers: { select: "No se pudieron leer goleadores" } }
    }).client);
    await expect(getAdminScorerHistory("group-a")).rejects.toThrow("No se pudieron leer goleadores");
  });

  it("no consulta suplentes de un partido ajeno al grupo seleccionado", async () => {
    const fake = createFakeSupabase({
      matches: [finishedMatch("foreign", { organization_id: "group-b" })],
      match_guests: [{ id: "guest-1", match_id: "foreign", guest_name: "Invitado ajeno", is_substitute: true }]
    });
    const from = vi.spyOn(fake.client, "from");
    mocks.client.mockResolvedValue(fake.client);
    expect(await getAdminMatchSubstitutes("foreign", "group-a")).toEqual([]);
    expect(from).toHaveBeenCalledOnce();
    expect(from).toHaveBeenCalledWith("matches");
  });
});
