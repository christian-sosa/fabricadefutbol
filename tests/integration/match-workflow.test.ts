import { describe, expect, it } from "vitest";

import {
  createDraftMatchWithOptions,
  regenerateDraftTeamOptions,
  saveConfirmedMatchLineup,
  saveMatchResult
} from "@/lib/domain/match-workflow";
import { calculateEffectiveSkillScore } from "@/lib/domain/skill-level";
import { createFakeSupabase } from "../helpers/fake-supabase";

const ORG_ID = "org-1";
const ADMIN_ID = "admin-1";
const SCHEDULED_AT = "2026-04-25T20:00:00.000Z";

function buildPlayers(count: number, organizationId = ORG_ID) {
  return Array.from({ length: count }, (_, index) => ({
    id: `player-${index + 1}`,
    organization_id: organizationId,
    full_name: `Jugador ${index + 1}`,
    initial_rank: index + 1,
    skill_level: Math.min(5, Math.floor(index / 2) + 1),
    display_order: index + 1,
    current_rating: 1000,
    active: true
  }));
}

function seedConfirmedMatch() {
  const players = buildPlayers(5);
  const fake = createFakeSupabase({
    organizations: [{ id: ORG_ID, name: "Liga A", slug: "liga-a" }],
    players,
    matches: [
      {
        id: "match-1",
        organization_id: ORG_ID,
        scheduled_at: SCHEDULED_AT,
        modality: "5v5",
        status: "confirmed",
        created_by: ADMIN_ID,
        confirmed_option_id: "option-1"
      }
    ],
    team_options: [
      {
        id: "option-1",
        match_id: "match-1",
        option_number: 1,
        is_confirmed: true,
        rating_sum_a: 20,
        rating_sum_b: 20,
        rating_diff: 0,
        created_by: ADMIN_ID
      }
    ],
    team_option_players: [
      { team_option_id: "option-1", player_id: "player-1", team: "A" },
      { team_option_id: "option-1", player_id: "player-2", team: "A" },
      { team_option_id: "option-1", player_id: "player-3", team: "B" },
      { team_option_id: "option-1", player_id: "player-4", team: "B" }
    ]
  });

  return { fake, players };
}

function seedConfirmedMatchWith(overrides: Parameters<typeof createFakeSupabase>[0] = {}) {
  const basePlayers = buildPlayers(5);
  const extraPlayers = overrides.players ?? [];
  const fake = createFakeSupabase({
    organizations: overrides.organizations ?? [{ id: ORG_ID, name: "Liga A", slug: "liga-a" }],
    players: [...basePlayers, ...extraPlayers],
    matches: overrides.matches ?? [
      {
        id: "match-1",
        organization_id: ORG_ID,
        scheduled_at: SCHEDULED_AT,
        modality: "5v5",
        status: "confirmed",
        created_by: ADMIN_ID,
        confirmed_option_id: "option-1"
      }
    ],
    team_options: overrides.team_options ?? [
      {
        id: "option-1",
        match_id: "match-1",
        option_number: 1,
        is_confirmed: true,
        rating_sum_a: 20,
        rating_sum_b: 20,
        rating_diff: 0,
        created_by: ADMIN_ID
      }
    ],
    team_option_players: overrides.team_option_players ?? [
      { team_option_id: "option-1", player_id: "player-1", team: "A" },
      { team_option_id: "option-1", player_id: "player-2", team: "A" },
      { team_option_id: "option-1", player_id: "player-3", team: "B" },
      { team_option_id: "option-1", player_id: "player-4", team: "B" }
    ],
    match_result: overrides.match_result ?? [],
    match_guests: overrides.match_guests ?? [],
    team_option_guests: overrides.team_option_guests ?? [],
    rating_history: overrides.rating_history ?? [],
    queryFailures: overrides.queryFailures
  });

  return { fake, players: [...basePlayers, ...extraPlayers] };
}

describe("match workflow", () => {
  it("crea un partido draft automatico con opciones y respeta arqueros separados", async () => {
    const players = buildPlayers(10);
    const fake = createFakeSupabase({
      organizations: [{ id: ORG_ID, name: "Liga A", slug: "liga-a" }],
      players
    });

    const matchId = await createDraftMatchWithOptions({
      supabase: fake.client as never,
      adminId: ADMIN_ID,
      organizationId: ORG_ID,
      scheduledAt: SCHEDULED_AT,
      modality: "5v5",
      selectedPlayerIds: players.map((player) => String(player.id)),
      invitedGuests: [],
      goalkeeperPlayerIds: ["player-1", "player-2"]
    });

    expect(matchId).toBeTruthy();
    expect(fake.find("matches", (row) => row.id === matchId)).toEqual(
      expect.objectContaining({
        status: "draft",
        modality: "5v5"
      })
    );

    const options = fake.table("team_options").filter((row) => row.match_id === matchId);
    expect(options).toHaveLength(3);

    for (const option of options) {
      const optionPlayers = fake
        .table("team_option_players")
        .filter((row) => row.team_option_id === option.id);
      const firstGoalkeeper = optionPlayers.find((row) => row.player_id === "player-1");
      const secondGoalkeeper = optionPlayers.find((row) => row.player_id === "player-2");
      expect(firstGoalkeeper?.team).not.toBe(secondGoalkeeper?.team);
    }
  });

  it("balancea con skill_level repetible y current_rating sin cambiar ratings al crear draft", async () => {
    const players = buildPlayers(8).map((player, index) => ({
      ...player,
      skill_level: [1, 1, 2, 2, 3, 3, 5, 5][index],
      current_rating: [1080, 1000, 1060, 990, 1000, 1000, 930, 980][index]
    }));
    const guests = [
      { key: "guest-1", name: "Invitado Nivel 1", rating: 1 },
      { key: "guest-2", name: "Invitado Nivel 4", rating: 4 }
    ];
    const fake = createFakeSupabase({
      organizations: [{ id: ORG_ID, name: "Liga A", slug: "liga-a" }],
      players
    });

    const expectedTotalScore =
      players.reduce(
        (sum, player) =>
          sum +
          calculateEffectiveSkillScore({
            skillLevel: player.skill_level,
            currentRating: player.current_rating
          }),
        0
      ) +
      guests.reduce(
        (sum, guest) =>
          sum +
          calculateEffectiveSkillScore({
            skillLevel: guest.rating,
            currentRating: 1000
          }),
        0
      );

    const matchId = await createDraftMatchWithOptions({
      supabase: fake.client as never,
      adminId: ADMIN_ID,
      organizationId: ORG_ID,
      scheduledAt: SCHEDULED_AT,
      modality: "5v5",
      selectedPlayerIds: players.map((player) => String(player.id)),
      invitedGuests: guests
    });

    const options = fake.table("team_options").filter((row) => row.match_id === matchId);
    expect(options).toHaveLength(3);
    for (const option of options) {
      expect(Number(option.rating_sum_a) + Number(option.rating_sum_b)).toBe(expectedTotalScore);
    }
    expect(fake.table("match_guests")).toEqual([
      expect.objectContaining({ guest_name: "Invitado Nivel 1", guest_rating: 1 }),
      expect.objectContaining({ guest_name: "Invitado Nivel 4", guest_rating: 4 })
    ]);
    expect(fake.find("players", (row) => row.id === "player-1")).toEqual(
      expect.objectContaining({ current_rating: 1080 })
    );
    expect(fake.table("rating_history")).toHaveLength(0);
  });

  it("crea y confirma un partido manual valido", async () => {
    const players = buildPlayers(10);
    const fake = createFakeSupabase({
      organizations: [{ id: ORG_ID, name: "Liga A", slug: "liga-a" }],
      players
    });

    const matchId = await createDraftMatchWithOptions({
      supabase: fake.client as never,
      adminId: ADMIN_ID,
      organizationId: ORG_ID,
      scheduledAt: SCHEDULED_AT,
      modality: "5v5",
      selectedPlayerIds: players.map((player) => String(player.id)),
      invitedGuests: [],
      teamCreationMode: "manual",
      manualTeamAssignments: players.map((player, index) => ({
        participantId: `player:${player.id}`,
        team: index < 5 ? "A" : "B"
      })),
      goalkeeperPlayerIds: ["player-1", "player-6"]
    });

    const match = fake.find("matches", (row) => row.id === matchId);
    expect(match).toEqual(
      expect.objectContaining({
        status: "confirmed",
        confirmed_option_id: expect.any(String)
      })
    );

    const options = fake.table("team_options").filter((row) => row.match_id === matchId);
    expect(options).toHaveLength(1);
    expect(options[0]?.is_confirmed).toBe(true);
  });

  it("rechaza un armado manual si falta asignar convocados", async () => {
    const players = buildPlayers(10);
    const fake = createFakeSupabase({
      organizations: [{ id: ORG_ID, name: "Liga A", slug: "liga-a" }],
      players
    });

    await expect(
      createDraftMatchWithOptions({
        supabase: fake.client as never,
        adminId: ADMIN_ID,
        organizationId: ORG_ID,
        scheduledAt: SCHEDULED_AT,
        modality: "5v5",
        selectedPlayerIds: players.map((player) => String(player.id)),
        invitedGuests: [],
        teamCreationMode: "manual",
        manualTeamAssignments: players.slice(0, 9).map((player, index) => ({
          participantId: `player:${player.id}`,
          team: index < 5 ? "A" : "B"
        }))
      })
    ).rejects.toThrow("debe asignar a todos los convocados");
  });

  it("rechaza un armado manual si los dos arqueros quedan en el mismo equipo", async () => {
    const players = buildPlayers(10);
    const fake = createFakeSupabase({
      organizations: [{ id: ORG_ID, name: "Liga A", slug: "liga-a" }],
      players
    });

    await expect(
      createDraftMatchWithOptions({
        supabase: fake.client as never,
        adminId: ADMIN_ID,
        organizationId: ORG_ID,
        scheduledAt: SCHEDULED_AT,
        modality: "5v5",
        selectedPlayerIds: players.map((player) => String(player.id)),
        invitedGuests: [],
        teamCreationMode: "manual",
        manualTeamAssignments: players.map((player, index) => ({
          participantId: `player:${player.id}`,
          team: index < 5 ? "A" : "B"
        })),
        goalkeeperPlayerIds: ["player-1", "player-2"]
      })
    ).rejects.toThrow("deben quedar en equipos separados");
  });

  it("rechaza cantidad total incorrecta", async () => {
    const players = buildPlayers(9);
    const fake = createFakeSupabase({
      players
    });

    await expect(
      createDraftMatchWithOptions({
        supabase: fake.client as never,
        adminId: ADMIN_ID,
        organizationId: ORG_ID,
        scheduledAt: SCHEDULED_AT,
        modality: "5v5",
        selectedPlayerIds: players.map((player) => String(player.id)),
        invitedGuests: []
      })
    ).rejects.toThrow("exactamente 10 jugadores");
  });

  it("rechaza una seleccion invalida de arqueros", async () => {
    const players = buildPlayers(10);
    const fake = createFakeSupabase({
      players
    });

    await expect(
      createDraftMatchWithOptions({
        supabase: fake.client as never,
        adminId: ADMIN_ID,
        organizationId: ORG_ID,
        scheduledAt: SCHEDULED_AT,
        modality: "5v5",
        selectedPlayerIds: players.map((player) => String(player.id)),
        invitedGuests: [],
        goalkeeperPlayerIds: ["player-1"]
      })
    ).rejects.toThrow("exactamente 2");
  });

  it("regenera opciones draft limpiando las anteriores", async () => {
    const players = buildPlayers(10);
    const fake = createFakeSupabase({
      organizations: [{ id: ORG_ID, name: "Liga A", slug: "liga-a" }],
      players
    });

    const matchId = await createDraftMatchWithOptions({
      supabase: fake.client as never,
      adminId: ADMIN_ID,
      organizationId: ORG_ID,
      scheduledAt: SCHEDULED_AT,
      modality: "5v5",
      selectedPlayerIds: players.map((player) => String(player.id)),
      invitedGuests: []
    });

    const beforeIds = new Set(
      fake
        .table("team_options")
        .filter((row) => row.match_id === matchId)
        .map((row) => String(row.id))
    );

    await regenerateDraftTeamOptions({
      supabase: fake.client as never,
      adminId: ADMIN_ID,
      matchId,
      organizationId: ORG_ID
    });

    const afterOptions = fake.table("team_options").filter((row) => row.match_id === matchId);
    expect(afterOptions).toHaveLength(3);
    expect(afterOptions.some((row) => beforeIds.has(String(row.id)))).toBe(false);
  });

  it("guarda resultado con handicap, invitado nuevo y actualiza ratings", async () => {
    const { fake } = seedConfirmedMatch();

    await saveMatchResult({
      supabase: fake.client as never,
      adminId: ADMIN_ID,
      matchId: "match-1",
      organizationId: ORG_ID,
      resultInput: {
        scoreA: 1,
        scoreB: 0,
        notes: "Ganaron con uno menos",
        lineup: {
          assignments: [
            { participantId: "player:player-1", team: "A" },
            { participantId: "player:player-2", team: "OUT" },
            { participantId: "player:player-3", team: "B" },
            { participantId: "player:player-4", team: "B" }
          ],
          newGuests: [{ name: "Invitado B", rating: 8, team: "B" }],
          handicapTeam: "A"
        }
      }
    });

    expect(fake.find("matches", (row) => row.id === "match-1")).toEqual(
      expect.objectContaining({
        status: "finished"
      })
    );
    expect(fake.find("match_result", (row) => row.match_id === "match-1")).toEqual(
      expect.objectContaining({
        score_a: 1,
        score_b: 0,
        winner_team: "A",
        notes: "Ganaron con uno menos"
      })
    );
    expect(fake.find("players", (row) => row.id === "player-1")).toEqual(
      expect.objectContaining({ current_rating: 1020 })
    );
    expect(fake.find("players", (row) => row.id === "player-2")).toEqual(
      expect.objectContaining({ current_rating: 1000 })
    );
    expect(fake.find("players", (row) => row.id === "player-3")).toEqual(
      expect.objectContaining({ current_rating: 980 })
    );
    expect(fake.find("players", (row) => row.id === "player-4")).toEqual(
      expect.objectContaining({ current_rating: 980 })
    );
    expect(fake.table("rating_history")).toHaveLength(3);
    expect(fake.table("match_guests")).toHaveLength(1);
    expect(fake.table("team_option_players").map((row) => row.player_id)).toEqual([
      "player-1",
      "player-3",
      "player-4"
    ]);
  });

  it("rechaza resultados con goles negativos", async () => {
    const { fake } = seedConfirmedMatch();

    await expect(
      saveMatchResult({
        supabase: fake.client as never,
        adminId: ADMIN_ID,
        matchId: "match-1",
        organizationId: ORG_ID,
        resultInput: {
          scoreA: -1,
          scoreB: 0
        }
      })
    ).rejects.toThrow("goles negativos");
  });

  it("rechaza marcar handicap si ese equipo no queda con menos jugadores", async () => {
    const { fake } = seedConfirmedMatch();

    await expect(
      saveMatchResult({
        supabase: fake.client as never,
        adminId: ADMIN_ID,
        matchId: "match-1",
        organizationId: ORG_ID,
        resultInput: {
          scoreA: 1,
          scoreB: 0,
          lineup: {
            assignments: [
              { participantId: "player:player-1", team: "A" },
              { participantId: "player:player-2", team: "A" },
              { participantId: "player:player-3", team: "B" },
              { participantId: "player:player-4", team: "B" }
            ],
            handicapTeam: "A"
          }
        }
      })
    ).rejects.toThrow("debe tener menos jugadores");
  });

  it("corrige un resultado revirtiendo el historial previo", async () => {
    const { fake } = seedConfirmedMatch();

    await saveMatchResult({
      supabase: fake.client as never,
      adminId: ADMIN_ID,
      matchId: "match-1",
      organizationId: ORG_ID,
      resultInput: {
        scoreA: 2,
        scoreB: 1
      }
    });

    await saveMatchResult({
      supabase: fake.client as never,
      adminId: ADMIN_ID,
      matchId: "match-1",
      organizationId: ORG_ID,
      resultInput: {
        scoreA: 0,
        scoreB: 2
      }
    });

    expect(fake.find("players", (row) => row.id === "player-1")).toEqual(
      expect.objectContaining({ current_rating: 990 })
    );
    expect(fake.find("players", (row) => row.id === "player-2")).toEqual(
      expect.objectContaining({ current_rating: 990 })
    );
    expect(fake.find("players", (row) => row.id === "player-3")).toEqual(
      expect.objectContaining({ current_rating: 1010 })
    );
    expect(fake.find("players", (row) => row.id === "player-4")).toEqual(
      expect.objectContaining({ current_rating: 1010 })
    );
    expect(fake.table("rating_history")).toHaveLength(4);
    expect(fake.find("match_result", (row) => row.match_id === "match-1")).toEqual(
      expect.objectContaining({
        winner_team: "B",
        score_a: 0,
        score_b: 2
      })
    );
  });

  it("ajusta la formacion confirmada antes del resultado con reemplazos e invitados", async () => {
    const { fake } = seedConfirmedMatch();

    await saveConfirmedMatchLineup({
      supabase: fake.client as never,
      matchId: "match-1",
      organizationId: ORG_ID,
      lineupInput: {
        assignments: [
          { participantId: "player:player-1", team: "A" },
          { participantId: "player:player-2", team: "OUT" },
          { participantId: "player:player-3", team: "B" },
          { participantId: "player:player-4", team: "B" }
        ],
        newPlayers: [{ playerId: "player-5", team: "A" }],
        newGuests: [{ name: "Invitado A", rating: 7, team: "A" }]
      }
    });

    const playerRows = fake.table("team_option_players");
    const guestRows = fake.table("team_option_guests");

    expect(playerRows).toEqual([
      expect.objectContaining({ team_option_id: "option-1", player_id: "player-1", team: "A" }),
      expect.objectContaining({ team_option_id: "option-1", player_id: "player-5", team: "A" }),
      expect.objectContaining({ team_option_id: "option-1", player_id: "player-3", team: "B" }),
      expect.objectContaining({ team_option_id: "option-1", player_id: "player-4", team: "B" })
    ]);
    expect(guestRows).toEqual([
      expect.objectContaining({ team_option_id: "option-1", team: "A" })
    ]);
  });

  it("rechaza ajustar la formacion si el partido ya tiene resultado", async () => {
    const { fake } = seedConfirmedMatchWith({
      match_result: [{ match_id: "match-1", score_a: 2, score_b: 1, winner_team: "A", created_by: ADMIN_ID }]
    });

    await expect(
      saveConfirmedMatchLineup({
        supabase: fake.client as never,
        matchId: "match-1",
        organizationId: ORG_ID,
        lineupInput: {
          assignments: [{ participantId: "player:player-1", team: "A" }]
        }
      })
    ).rejects.toThrow("ya tiene resultado");
  });

  it("rechaza agregar un reemplazo que no pertenece al grupo", async () => {
    const { fake } = seedConfirmedMatchWith({
      players: [
        {
          id: "player-6",
          organization_id: "org-2",
          full_name: "Intruso",
          initial_rank: 6,
          current_rating: 970,
          active: true
        }
      ]
    });

    await expect(
      saveConfirmedMatchLineup({
        supabase: fake.client as never,
        matchId: "match-1",
        organizationId: ORG_ID,
        lineupInput: {
          assignments: [
            { participantId: "player:player-1", team: "A" },
            { participantId: "player:player-2", team: "OUT" },
            { participantId: "player:player-3", team: "B" },
            { participantId: "player:player-4", team: "B" }
          ],
          newPlayers: [{ playerId: "player-6", team: "A" }]
        }
      })
    ).rejects.toThrow("no existe o no pertenece a este grupo");
  });

  it("rechaza reemplazos duplicados en la formacion final", async () => {
    const { fake } = seedConfirmedMatchWith({
      players: [
        {
          id: "player-6",
          organization_id: ORG_ID,
          full_name: "Reemplazo",
          initial_rank: 6,
          current_rating: 970,
          active: true
        }
      ]
    });

    await expect(
      saveConfirmedMatchLineup({
        supabase: fake.client as never,
        matchId: "match-1",
        organizationId: ORG_ID,
        lineupInput: {
          assignments: [
            { participantId: "player:player-1", team: "A" },
            { participantId: "player:player-2", team: "OUT" },
            { participantId: "player:player-3", team: "B" },
            { participantId: "player:player-4", team: "B" }
          ],
          newPlayers: [
            { playerId: "player-6", team: "A" },
            { playerId: "player-6", team: "B" }
          ]
        }
      })
    ).rejects.toThrow("reemplazo duplicados");
  });
});
