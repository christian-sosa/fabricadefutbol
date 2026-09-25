import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.client }));

import { getAdminHistoricalScorers, getAdminMatchSubstitutes } from "@/lib/queries/admin-match-extras";
import { createFakeSupabase } from "../helpers/fake-supabase";

function finishedMatch(id: string, overrides: Record<string, unknown> = {}) {
  return { id, confirmed_option_id: `option-${id}`, organization_id: "group-a", status: "finished", modality: "11v11", scheduled_at: "2026-09-25T19:00:00Z", ...overrides };
}

function playerScorer(matchId: string, playerId: string, goals: number, displayName = playerId) {
  return { match_id: matchId, participant_id: `player:${playerId}`, player_id: playerId, display_name: displayName, team: "A", goals };
}

function guestScorer(matchId: string, guestId: string, goals: number, displayName = guestId) {
  return { match_id: matchId, participant_id: `guest:${guestId}`, player_id: null, guest_id: guestId, display_name: displayName, team: "B", goals };
}

function finalPlayer(matchId: string, playerId: string, team = "A") {
  return { team_option_id: `option-${matchId}`, player_id: playerId, team };
}

function createHistorySupabase(seed: Parameters<typeof createFakeSupabase>[0] = {}) {
  // Scorers must belong to the final lineup. Tests can provide other participants explicitly.
  const options = new Map(seed.matches?.map((match) => [match.id, match.confirmed_option_id]));
  return createFakeSupabase({
    ...seed,
    team_option_players: seed.team_option_players ?? seed.match_goal_scorers?.flatMap((scorer) => scorer.player_id && options.get(scorer.match_id)
      ? [{ team_option_id: options.get(scorer.match_id), player_id: scorer.player_id, team: scorer.team }] : [])
  });
}

describe("consultas privadas de suplentes y goleadores", () => {
  beforeEach(() => mocks.client.mockReset());

  it("acumula todas las temporadas por ID y usa el nombre actual incluso para jugadores inactivos", async () => {
    mocks.client.mockResolvedValue(createHistorySupabase({
      matches: [
        finishedMatch("old", { season_id: "2025", scheduled_at: "2025-09-25T19:00:00Z", modality: "9v9" }),
        finishedMatch("new", { season_id: "2026", modality: "10v10" }),
        finishedMatch("without-scorers")
      ],
      players: [
        { id: "ana", organization_id: "group-a", full_name: "Ana Actual", active: false },
        { id: "bea", organization_id: "group-a", full_name: "Bea" }
      ],
      match_goal_scorers: [
        playerScorer("old", "ana", 2, "Ana Anterior"),
        playerScorer("new", "ana", 3, "Ana Otro nombre"),
        playerScorer("new", "bea", 1, "Bea")
      ]
    }).client);

    expect(await getAdminHistoricalScorers("group-a")).toEqual({
      scorers: [
        { playerId: "ana", displayName: "Ana Actual", goals: 5, matchesPlayed: 2, rank: 1 },
        { playerId: "bea", displayName: "Bea", goals: 1, matchesPlayed: 1, rank: 2 }
      ],
      page: 1, pageCount: 1, totalScorers: 2, totalGoals: 6, guestGoals: 0, matchesRecorded: 2
    });
  });

  it("conserva el snapshot del partido más reciente cuando no se puede leer el nombre actual", async () => {
    mocks.client.mockResolvedValue(createHistorySupabase({
      matches: [
        finishedMatch("a-older", { scheduled_at: "2024-01-01T19:00:00Z" }),
        finishedMatch("z-newer", { scheduled_at: "2026-01-01T19:00:00Z" })
      ],
      players: [{ id: "missing", organization_id: "group-b", full_name: "Nombre de otro grupo" }],
      match_goal_scorers: [playerScorer("a-older", "missing", 2, "Nombre anterior"), playerScorer("z-newer", "missing", 3, "Nombre reciente")]
    }).client);

    expect((await getAdminHistoricalScorers("group-a")).scorers).toEqual([
      { playerId: "missing", displayName: "Nombre reciente", goals: 5, matchesPlayed: 2, rank: 1 }
    ]);
  });

  it("computa participaciones sin marcar cuando otro autor está cargado o el partido terminó 0–0", async () => {
    const matchIds = ["scored", "guest-authored", "player-authored", "scoreless", "unrecorded", "without-result"];
    mocks.client.mockResolvedValue(createHistorySupabase({
      matches: matchIds.map((id) => finishedMatch(id)),
      match_goal_scorers: [playerScorer("scored", "ana", 2, "Ana"), guestScorer("guest-authored", "guest", 1), playerScorer("player-authored", "bea", 1, "Bea")],
      match_result: [
        { match_id: "scored", score_a: 2, score_b: 0 },
        { match_id: "guest-authored", score_a: 7, score_b: 2 },
        { match_id: "player-authored", score_a: 1, score_b: 0 },
        { match_id: "scoreless", score_a: 0, score_b: 0 },
        { match_id: "unrecorded", score_a: 3, score_b: 1 }
      ],
      team_option_players: [
        ...matchIds.flatMap((id) => [finalPlayer(id, "ana"), finalPlayer(id, "never-scored")]),
        finalPlayer("player-authored", "bea")
      ]
    }).client);

    expect(await getAdminHistoricalScorers("group-a")).toEqual({
      scorers: [
        { playerId: "ana", displayName: "Ana", goals: 2, matchesPlayed: 4, rank: 1 },
        { playerId: "bea", displayName: "Bea", goals: 1, matchesPlayed: 1, rank: 2 }
      ],
      page: 1, pageCount: 1, totalScorers: 2, totalGoals: 4, guestGoals: 1, matchesRecorded: 4
    });
  });

  it("cuenta suplentes que entraron, excluye banco y ausentes y no usa otras opciones de equipos", async () => {
    const playerIds = ["starter", "used-substitute", "unused-substitute", "absent"];
    mocks.client.mockResolvedValue(createHistorySupabase({
      matches: [finishedMatch("previous"), finishedMatch("final")],
      match_goal_scorers: [
        ...playerIds.map((id) => playerScorer("previous", id, 1)),
        guestScorer("final", "guest", 1)
      ],
      match_players: playerIds.map((id) => ({ match_id: "final", player_id: id, is_substitute: id.includes("substitute"), substitute_team: null })),
      team_option_players: [
        ...playerIds.map((id) => finalPlayer("previous", id)),
        finalPlayer("final", "starter"), finalPlayer("final", "used-substitute", "B"),
        { team_option_id: "unconfirmed-final", player_id: "unused-substitute", team: "A" },
        { team_option_id: "unconfirmed-final", player_id: "absent", team: "B" }
      ]
    }).client);

    const history = await getAdminHistoricalScorers("group-a");
    expect(Object.fromEntries(history.scorers.map((scorer) => [scorer.playerId, scorer.matchesPlayed])))
      .toEqual({ starter: 2, "used-substitute": 2, "unused-substitute": 1, absent: 1 });
    expect(history.matchesRecorded).toBe(2);
  });

  it("un 0–0 sin goleadores aparece en el resumen y mantiene vacío el ranking de jugadores con goles", async () => {
    mocks.client.mockResolvedValue(createHistorySupabase({
      matches: [finishedMatch("draw")],
      match_result: [{ match_id: "draw", score_a: 0, score_b: 0 }],
      team_option_players: [finalPlayer("draw", "ana")]
    }).client);

    expect(await getAdminHistoricalScorers("group-a")).toEqual({
      scorers: [], page: 1, pageCount: 1, totalScorers: 0, totalGoals: 0, guestGoals: 0, matchesRecorded: 1
    });
  });

  it("comparte puesto en empates y ordena por nombre en español e ID sin fusionar homónimos", async () => {
    mocks.client.mockResolvedValue(createHistorySupabase({
      matches: [finishedMatch("match")],
      match_goal_scorers: [
        playerScorer("match", "n", 3, "Nora"), playerScorer("match", "b", 3, "Álvaro"),
        playerScorer("match", "a", 3, "Álvaro"), playerScorer("match", "z", 1, "Zoe")
      ]
    }).client);

    expect((await getAdminHistoricalScorers("group-a")).scorers.map(({ playerId, rank }) => ({ playerId, rank })))
      .toEqual([{ playerId: "a", rank: 1 }, { playerId: "b", rank: 1 }, { playerId: "n", rank: 1 }, { playerId: "z", rank: 4 }]);
  });

  it("aísla grupo, estado y modalidades; cuenta invitados sin asociarlos a jugadores del mismo nombre", async () => {
    mocks.client.mockResolvedValue(createHistorySupabase({
      matches: [
        finishedMatch("eligible"), finishedMatch("guests-only"),
        finishedMatch("foreign", { organization_id: "group-b" }),
        finishedMatch("small", { modality: "7v7" }), finishedMatch("draft", { status: "draft" }),
        finishedMatch("confirmed", { status: "confirmed" })
      ],
      match_goal_scorers: [
        playerScorer("eligible", "ana", 2, "Ana"),
        guestScorer("eligible", "guest-1", 3, "Ana"), guestScorer("guests-only", "guest-2", 4, "Ana"),
        ...["foreign", "small", "draft", "confirmed"].map((matchId) => playerScorer(matchId, "excluded", 99, "Ajeno"))
      ],
      match_result: ["foreign", "small", "draft", "confirmed"].map((matchId) => ({ match_id: matchId, score_a: 0, score_b: 0 })),
      team_option_players: ["eligible", "guests-only", "foreign", "small", "draft", "confirmed"].map((id) => finalPlayer(id, "ana"))
    }).client);

    expect(await getAdminHistoricalScorers("group-a")).toEqual({
      scorers: [{ playerId: "ana", displayName: "Ana", goals: 2, matchesPlayed: 2, rank: 1 }],
      page: 1, pageCount: 1, totalScorers: 1, totalGoals: 9, guestGoals: 7, matchesRecorded: 2
    });
  });

  it("pagina jugadores después de calcular acumulados y mantiene puestos y totales entre páginas", async () => {
    const ids = Array.from({ length: 22 }, (_, index) => `p${String(index).padStart(2, "0")}`);
    mocks.client.mockResolvedValue(createHistorySupabase({
      matches: [finishedMatch("first"), finishedMatch("second")],
      match_goal_scorers: [
        ...ids.map((id, index) => playerScorer("first", id, 22 - index)), playerScorer("second", "p21", 23)
      ]
    }).client);

    const firstPage = await getAdminHistoricalScorers("group-a");
    const lastPage = await getAdminHistoricalScorers("group-a", 999999);
    expect(firstPage.scorers).toHaveLength(20);
    expect(firstPage.scorers[0]).toEqual({ playerId: "p21", displayName: "p21", goals: 24, matchesPlayed: 2, rank: 1 });
    expect(lastPage.scorers).toEqual([
      { playerId: "p19", displayName: "p19", goals: 3, matchesPlayed: 1, rank: 21 },
      { playerId: "p20", displayName: "p20", goals: 2, matchesPlayed: 1, rank: 22 }
    ]);
    expect(lastPage).toMatchObject({ page: 2, pageCount: 2, totalScorers: 22, totalGoals: 276, guestGoals: 0, matchesRecorded: 2 });
    expect(firstPage).toMatchObject({ page: 1, pageCount: 2, totalScorers: 22, totalGoals: 276 });
  });

  it("recupera partidos, autores y nombres completos ante límites de servidor y lotes grandes de IDs", async () => {
    const matches = Array.from({ length: 205 }, (_, index) => finishedMatch(`match-${String(index).padStart(3, "0")}`));
    const players = Array.from({ length: 410 }, (_, index) => ({
      id: `p${String(index).padStart(3, "0")}`, organization_id: "group-a", full_name: `Nombre actual ${index}`
    }));
    const draws = matches.map((match) => finishedMatch(`draw-${match.id}`));
    const fake = createHistorySupabase({
      matches: [...matches, ...draws], players,
      match_goal_scorers: players.map((player, index) => playerScorer(matches[Math.floor(index / 2)].id, player.id, index % 5 + 1, "Nombre anterior")),
      match_result: draws.map((match) => ({ match_id: match.id, score_a: 0, score_b: 0 })),
      team_option_players: players.flatMap((player, index) => [finalPlayer(matches[Math.floor(index / 2)].id, player.id), finalPlayer(draws[Math.floor(index / 2)].id, player.id)])
    });
    const from = fake.client.from.bind(fake.client);
    const batchSizes: number[] = [];
    vi.spyOn(fake.client, "from").mockImplementation((table) => {
      const query = from(table);
      query.limit(17);
      const filterIds = query.in.bind(query);
      vi.spyOn(query, "in").mockImplementation((column, values) => {
        if (column === "id" || column === "match_id" || column === "team_option_id") batchSizes.push(values.length);
        return filterIds(column, values);
      });
      return query;
    });
    mocks.client.mockResolvedValue(fake.client);

    const history = await getAdminHistoricalScorers("group-a", 999999);
    expect(history).toMatchObject({ page: 21, pageCount: 21, totalScorers: 410, totalGoals: 1230, guestGoals: 0, matchesRecorded: 410 });
    expect(history.scorers).toHaveLength(10);
    expect(history.scorers.every((scorer) => scorer.displayName.startsWith("Nombre actual "))).toBe(true);
    expect(history.scorers.every((scorer) => scorer.matchesPlayed === 2)).toBe(true);
    expect(Math.max(...batchSizes)).toBeLessThanOrEqual(200);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])("normaliza página inválida %s", async (page) => {
    mocks.client.mockResolvedValue(createHistorySupabase({ matches: [finishedMatch("match")], match_goal_scorers: [playerScorer("match", "ana", 1)] }).client);
    expect((await getAdminHistoricalScorers("group-a", page)).page).toBe(1);
  });

  it("devuelve un historial vacío sin consultar autores cuando no hay partidos elegibles", async () => {
    const fake = createHistorySupabase({});
    const from = vi.spyOn(fake.client, "from");
    mocks.client.mockResolvedValue(fake.client);
    expect(await getAdminHistoricalScorers("group-a", 9)).toEqual({
      scorers: [], page: 1, pageCount: 1, totalScorers: 0, totalGoals: 0, guestGoals: 0, matchesRecorded: 0
    });
    expect(from).toHaveBeenCalledOnce();
    expect(from).toHaveBeenCalledWith("matches");
  });

  it.each(["matches", "match_goal_scorers", "match_result", "players", "team_option_players"] as const)("propaga errores de %s sin presentar acumulados incompletos", async (table) => {
    mocks.client.mockResolvedValue(createHistorySupabase({
      matches: [finishedMatch("match")], match_goal_scorers: [playerScorer("match", "ana", 1)],
      queryFailures: { [table]: { select: `Error al consultar ${table}` } }
    }).client);
    await expect(getAdminHistoricalScorers("group-a")).rejects.toThrow(`Error al consultar ${table}`);
  });

  it("no consulta suplentes de un partido ajeno al grupo seleccionado", async () => {
    const fake = createHistorySupabase({
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
