import { describe, expect, it } from "vitest";

import {
  createDraftMatchWithOptions,
  confirmTeamOption,
  regenerateDraftTeamOptions
} from "@/lib/domain/match-workflow";
import {
  calculateEffectiveSkillScore,
  calculateGuestSkillScore,
  GUEST_FEATURED_SKILL_LEVEL
} from "@/lib/domain/skill-level";
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
    skill_level: Math.min(7, Math.floor(index / 2) + 1),
    display_order: index + 1,
    current_rating: 1000,
    active: true
  }));
}

describe("match workflow", () => {
  it.each(["9v9", "10v10", "11v11"] as const)("conserva suplentes de %s fuera del balance al crear y regenerar", async (modality) => {
    const starterCount = Number(modality.split("v")[0]) * 2;
    const players = buildPlayers(starterCount + 1);
    const fake = createFakeSupabase({ players });
    const substituteId = players.at(-1)!.id;
    const matchId = await createDraftMatchWithOptions({
      supabase: fake.client as never, adminId: ADMIN_ID, organizationId: ORG_ID,
      scheduledAt: SCHEDULED_AT, modality, selectedPlayerIds: players.map((player) => player.id),
      invitedGuests: [{ key: "bench", name: "Refuerzo", rating: 2 }],
      substituteAssignments: [
        { participantId: `player:${substituteId}`, team: null },
        { participantId: "guest:bench", team: "B" }
      ]
    });
    expect(fake.find("match_players", (row) => row.player_id === substituteId)).toMatchObject({ is_substitute: true, substitute_team: null });
    expect(fake.table("match_guests")[0]).toMatchObject({ is_substitute: true, substitute_team: "B" });
    const verifyOptions = () => {
      expect(fake.table("team_option_guests")).toHaveLength(0);
      expect(fake.table("team_options")).toHaveLength(3);
      for (const option of fake.table("team_options")) {
        const roster = fake.table("team_option_players").filter((row) => row.team_option_id === option.id);
        expect(roster).toHaveLength(starterCount);
        expect(roster.some((row) => row.player_id === substituteId)).toBe(false);
        expect(roster.filter((row) => row.team === "A")).toHaveLength(starterCount / 2);
      }
    };
    verifyOptions();
    await regenerateDraftTeamOptions({ supabase: fake.client as never, adminId: ADMIN_ID, organizationId: ORG_ID, matchId });
    verifyOptions();
  });

  it.each([
    { modality: "5v5" as const, assignments: [{ participantId: "player:player-11", team: null }], goalkeepers: [], message: "únicamente en F9" },
    { modality: "9v9" as const, assignments: [{ participantId: "player:unknown", team: null }], goalkeepers: [], message: "formar parte" },
    { modality: "9v9" as const, assignments: [{ participantId: "player:player-1", team: null }, { participantId: "player:player-1", team: null }], goalkeepers: [], message: "duplicados" },
    { modality: "9v9" as const, assignments: [{ participantId: "player:player-1", team: null }], goalkeepers: ["player-1", "player-2"], message: "arqueros titulares" }
  ])("rechaza suplentes inválidos antes de crear registros: $message", async ({ modality, assignments, goalkeepers, message }) => {
    const players = buildPlayers(19);
    const fake = createFakeSupabase({ players });
    await expect(createDraftMatchWithOptions({
      supabase: fake.client as never, adminId: ADMIN_ID, organizationId: ORG_ID,
      scheduledAt: SCHEDULED_AT, modality, selectedPlayerIds: players.map((player) => player.id), invitedGuests: [],
      substituteAssignments: assignments, goalkeeperPlayerIds: goalkeepers
    })).rejects.toThrow(message);
    expect(fake.table("matches")).toHaveLength(0);
  });

  it("confirma equipos manuales de F10 con suplentes aparte", async () => {
    const players = buildPlayers(21);
    const fake = createFakeSupabase({ players });
    const matchId = await createDraftMatchWithOptions({
      supabase: fake.client as never, adminId: ADMIN_ID, organizationId: ORG_ID,
      scheduledAt: SCHEDULED_AT, modality: "10v10", selectedPlayerIds: players.map((player) => player.id), invitedGuests: [],
      substituteAssignments: [{ participantId: "player:player-21", team: "A" }], teamCreationMode: "manual",
      manualTeamAssignments: players.slice(0, 20).map((player, index) => ({ participantId: `player:${player.id}`, team: index < 10 ? "A" : "B" }))
    });
    expect(fake.find("matches", (row) => row.id === matchId)?.status).toBe("confirmed");
    expect(fake.table("team_option_players")).toHaveLength(20);
    expect(fake.table("match_players")).toHaveLength(21);
  });

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

  it("crea borradores sin nombres de equipos personalizados", async () => {
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

    expect(fake.find("matches", (row) => row.id === matchId)).toEqual(
      expect.objectContaining({
        team_a_label: null,
        team_b_label: null
      })
    );
  });

  it("balancea con skill_level repetible y current_rating sin cambiar ratings al crear draft", async () => {
    const players = buildPlayers(8).map((player, index) => ({
      ...player,
      skill_level: [1, 1, 2, 2, 3, 3, 5, 5][index],
      current_rating: [1080, 1000, 1060, 990, 1000, 1000, 930, 980][index]
    }));
    const guests = [
      { key: "guest-1", name: "Invitado destacado", rating: GUEST_FEATURED_SKILL_LEVEL },
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
      guests.reduce((sum, guest) => sum + calculateGuestSkillScore(guest.rating), 0);

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
      expect.objectContaining({
        guest_name: "Invitado destacado",
        guest_rating: GUEST_FEATURED_SKILL_LEVEL
      }),
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

  it("guarda nombres de equipos al confirmar una opcion generada", async () => {
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

    const optionId = String(fake.table("team_options").find((row) => row.match_id === matchId)?.id);

    await confirmTeamOption({
      supabase: fake.client as never,
      matchId,
      optionId,
      organizationId: ORG_ID,
      teamALabel: "Los Pibes",
      teamBLabel: "Veteranos"
    });

    expect(fake.find("matches", (row) => row.id === matchId)).toEqual(
      expect.objectContaining({
        status: "confirmed",
        confirmed_option_id: optionId,
        team_a_label: "Los Pibes",
        team_b_label: "Veteranos"
      })
    );
  });

  it("mantiene arqueros separados tambien al regenerar", async () => {
    const players = buildPlayers(10);
    const fake = createFakeSupabase({ players });
    const matchId = await createDraftMatchWithOptions({ supabase: fake.client as never, adminId: ADMIN_ID, organizationId: ORG_ID,
      scheduledAt: SCHEDULED_AT, modality: "5v5", selectedPlayerIds: players.map((p) => p.id), invitedGuests: [], goalkeeperPlayerIds: ["player-1", "player-10"] });
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await regenerateDraftTeamOptions({ supabase: fake.client as never, adminId: ADMIN_ID, organizationId: ORG_ID, matchId });
      for (const option of fake.table("team_options")) {
        const rows = fake.table("team_option_players").filter((row) => row.team_option_id === option.id);
        expect(rows.find((row) => row.player_id === "player-1")?.team).not.toBe(rows.find((row) => row.player_id === "player-10")?.team);
      }
    }
  });
});
