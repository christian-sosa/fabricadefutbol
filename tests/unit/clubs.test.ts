import { describe, expect, it } from "vitest";

import {
  buildClubCallupSummary,
  buildClubFinancialSummary,
  buildClubPublicSnapshot,
  buildClubTeamRosterOptions,
  calculateCallupEstimatedPaymentCents,
  filterClubPublicSnapshotByModality,
  filterClubPlayersForRosterManagement,
  getClubPaymentStatus,
  splitClubMatchCost,
  validateClubMatchSheet
} from "@/lib/domain/clubs";

const club = {
  id: "club-1",
  name: "La Quinta",
  slug: "la-quinta",
  description: null,
  home_venue: null,
  logo_path: null,
  is_public: true,
  status: "active" as const,
  created_at: "2026-04-01T00:00:00Z"
};

const team = {
  id: "team-1",
  club_id: "club-1",
  name: "La Quinta Senior",
  short_name: "LQ",
  logo_path: null,
  modality: "11v11" as const,
  active: true,
  created_at: "2026-04-05T12:00:00Z"
};

const reserveTeam = {
  id: "team-2",
  club_id: "club-1",
  name: "La Quinta Reserva",
  short_name: "LQR",
  logo_path: null,
  modality: "5v5" as const,
  active: true,
  created_at: "2026-04-06T12:00:00Z"
};

const competition = {
  id: "competition-1",
  club_id: "club-1",
  name: "LAFAB",
  slug: "lafab",
  active: true,
  notes: null
};

describe("club match sheet validation", () => {
  it("acepta un partido 11 vs 11 con suplentes", () => {
    const errors = validateClubMatchSheet({
      modality: "11v11",
      goalsFor: 3,
      goalsAgainst: 1,
      participants: [
        ...Array.from({ length: 11 }, (_, index) => ({
          playerId: `player-${index + 1}`,
          role: "starter" as const,
          goals: index === 0 ? 2 : index === 1 ? 1 : 0,
          assists: index === 2 ? 2 : index === 3 ? 1 : 0,
          isMvp: index === 0
        })),
        {
          guestName: "Invitado",
          role: "substitute" as const,
          goals: 0,
          assists: 0
        }
      ]
    });

    expect(errors).toEqual([]);
  });

  it("acepta partidos con la cantidad de titulares de la modalidad", () => {
    expect(
      validateClubMatchSheet({
        modality: "5v5",
        goalsFor: 2,
        goalsAgainst: 0,
        participants: Array.from({ length: 5 }, (_, index) => ({
          playerId: `player-5-${index + 1}`,
          role: "starter" as const,
          goals: index === 0 ? 2 : 0,
          assists: 0
        }))
      })
    ).toEqual([]);

    expect(
      validateClubMatchSheet({
        modality: "7v7",
        goalsFor: 1,
        goalsAgainst: 1,
        participants: Array.from({ length: 7 }, (_, index) => ({
          playerId: `player-7-${index + 1}`,
          role: "starter" as const,
          goals: 0,
          assists: 0
        }))
      })
    ).toEqual([]);
  });

  it("rechaza planillas sin la cantidad exacta de titulares segun modalidad", () => {
    const errors = validateClubMatchSheet({
      modality: "5v5",
      goalsFor: 1,
      goalsAgainst: 0,
      participants: Array.from({ length: 6 }, (_, index) => ({
        playerId: `player-${index + 1}`,
        role: "starter" as const,
        goals: 0,
        assists: 0
      }))
    });

    expect(errors).toContain("El partido 5v5 debe tener exactamente 5 titulares.");
  });

  it("rechaza goles y asistencias mayores a los goles a favor", () => {
    const participants = Array.from({ length: 11 }, (_, index) => ({
      playerId: `player-${index + 1}`,
      role: "starter" as const,
      goals: index < 3 ? 1 : 0,
      assists: index < 3 ? 1 : 0
    }));

    const errors = validateClubMatchSheet({
      modality: "11v11",
      goalsFor: 2,
      goalsAgainst: 0,
      participants
    });

    expect(errors).toContain("La suma de goleadores no puede superar los goles a favor.");
    expect(errors).toContain("La suma de asistencias no puede superar los goles a favor.");
  });

  it("rechaza estadisticas para presentes que no entraron", () => {
    const errors = validateClubMatchSheet({
      modality: "11v11",
      goalsFor: 1,
      goalsAgainst: 0,
      participants: [
        ...Array.from({ length: 11 }, (_, index) => ({
          playerId: `player-${index + 1}`,
          role: "starter" as const,
          goals: index === 0 ? 1 : 0,
          assists: 0
        })),
        {
          playerId: "player-12",
          role: "present" as const,
          goals: 1,
          assists: 1,
          isMvp: true
        }
      ]
    });

    expect(errors).toContain("Un jugador que fue pero no entro no puede tener goles, asistencias ni figura.");
  });
});

describe("club finances", () => {
  it("divide el costo de cancha entre participantes sin perder centavos", () => {
    const shares = splitClubMatchCost(10001, ["lineup-1", "lineup-2", "lineup-3"]);

    expect(shares).toEqual([
      { lineupId: "lineup-1", expectedCents: 3334 },
      { lineupId: "lineup-2", expectedCents: 3334 },
      { lineupId: "lineup-3", expectedCents: 3333 }
    ]);
    expect(shares.reduce((total, share) => total + share.expectedCents, 0)).toBe(10001);
  });

  it("deriva estado de pago desde monto esperado y monto pagado", () => {
    expect(getClubPaymentStatus({ expected_cents: 2500, paid_cents: 2500 })).toBe("paid");
    expect(getClubPaymentStatus({ expected_cents: 2500, paid_cents: 0 })).toBe("unpaid");
    expect(getClubPaymentStatus({ expected_cents: 2500, paid_cents: 1200 })).toBe("partial");
    expect(getClubPaymentStatus({ expected_cents: 0, paid_cents: 0 })).toBe("paid");
  });

  it("agrega deuda por partido y por jugador del club", () => {
    const summary = buildClubFinancialSummary({
      matches: [
        {
          id: "match-1",
          club_id: "club-1",
          club_team_id: "team-1",
          club_competition_id: "competition-1",
          modality: "5v5",
          played_at: "2026-05-01T20:00:00Z",
          opponent_name: "Rival F5",
          venue: "Cancha 1",
          goals_for: 3,
          goals_against: 2,
          status: "played",
          notes: null,
          field_cost_cents: 10000,
          field_cost_currency: "ARS"
        }
      ],
      lineups: [
        {
          id: "lineup-1",
          match_id: "match-1",
          club_player_id: "player-1",
          guest_name: null,
          display_name: "Sosa",
          role: "starter"
        },
        {
          id: "lineup-2",
          match_id: "match-1",
          club_player_id: "player-2",
          guest_name: null,
          display_name: "Nacho",
          role: "starter"
        }
      ],
      payments: [
        {
          id: "payment-1",
          match_id: "match-1",
          lineup_id: "lineup-1",
          expected_cents: 5000,
          paid_cents: 5000,
          paid_at: "2026-05-01T21:00:00Z",
          notes: null
        },
        {
          id: "payment-2",
          match_id: "match-1",
          lineup_id: "lineup-2",
          expected_cents: 5000,
          paid_cents: 1500,
          paid_at: "2026-05-01T21:00:00Z",
          notes: "Pago parcial"
        }
      ]
    });

    expect(summary.totals).toEqual({
      matchCount: 1,
      totalCostCents: 10000,
      expectedCents: 10000,
      paidCents: 6500,
      pendingCents: 3500
    });
    expect(summary.matches).toEqual([
      {
        matchId: "match-1",
        opponentName: "Rival F5",
        playedAt: "2026-05-01T20:00:00Z",
        participantCount: 2,
        costCents: 10000,
        expectedCents: 10000,
        paidCents: 6500,
        pendingCents: 3500,
        status: "partial"
      }
    ]);
    expect(summary.players).toEqual([
      {
        key: "player:player-2",
        playerId: "player-2",
        displayName: "Nacho",
        matchCount: 1,
        expectedCents: 5000,
        paidCents: 1500,
        pendingCents: 3500,
        status: "partial"
      },
      {
        key: "player:player-1",
        playerId: "player-1",
        displayName: "Sosa",
        matchCount: 1,
        expectedCents: 5000,
        paidCents: 5000,
        pendingCents: 0,
        status: "paid"
      }
    ]);
  });
});

describe("club callup planning", () => {
  it("estima el pago por jugador dividiendo costo de cancha por jugadores ideales", () => {
    expect(calculateCallupEstimatedPaymentCents(3600000, 14)).toBe(257143);
    expect(calculateCallupEstimatedPaymentCents(0, 14)).toBe(0);
  });

  it("calcula cupo, pagadores equivalentes y faltantes por posicion", () => {
    const summary = buildClubCallupSummary({
      callup: {
        id: "callup-1",
        club_id: "club-1",
        club_team_id: "team-1",
        scheduled_at: "2026-05-16T20:00:00Z",
        opponent_name: "Rival",
        venue: "La Quinta",
        status: "draft",
        ideal_player_count: 14,
        max_player_count: 16,
        target_payment_count: 14,
        full_payment_cents: 2500000,
        field_cost_cents: 35000000,
        notes: null
      },
      entries: [
        { id: "entry-1", callup_id: "callup-1", club_player_id: "player-1", status: "confirmed", expected_cents: null, notes: null },
        { id: "entry-2", callup_id: "callup-1", club_player_id: "player-2", status: "confirmed", expected_cents: 1500000, notes: null },
        { id: "entry-3", callup_id: "callup-1", club_player_id: "player-3", status: "confirmed", expected_cents: null, notes: null },
        { id: "entry-4", callup_id: "callup-1", club_player_id: "player-4", status: "tentative", expected_cents: null, notes: null },
        { id: "entry-5", callup_id: "callup-1", club_player_id: "player-5", status: "injured", expected_cents: null, notes: null }
      ],
      players: [
        { id: "player-1", club_id: "club-1", full_name: "Arquero", nickname: null, position: "arquero", shirt_number: null, photo_path: null, active: true },
        { id: "player-2", club_id: "club-1", full_name: "Pitu", nickname: null, position: "defensor", shirt_number: null, photo_path: null, active: true, default_payment_cents: 1500000 },
        { id: "player-3", club_id: "club-1", full_name: "Nueve", nickname: null, position: "delantero", shirt_number: null, photo_path: null, active: true },
        { id: "player-4", club_id: "club-1", full_name: "Dudoso", nickname: null, position: "volante", shirt_number: null, photo_path: null, active: true },
        { id: "player-5", club_id: "club-1", full_name: "Isa", nickname: null, position: "defensor", shirt_number: null, photo_path: null, active: true }
      ]
    });

    expect(summary.confirmedCount).toBe(3);
    expect(summary.availableCount).toBe(4);
    expect(summary.remainingIdealSlots).toBe(11);
    expect(summary.remainingMaxSlots).toBe(13);
    expect(summary.confirmedExpectedCents).toBe(6500000);
    expect(summary.paymentEquivalentCount).toBe(2.6);
    expect(summary.paymentEquivalentMissing).toBe(11.4);
    expect(summary.revenueMissingCents).toBe(28500000);
    expect(summary.positionNeeds).toEqual([
      { position: "defensor", label: "Defensor", needed: 3 },
      { position: "volante", label: "Volante", needed: 4 },
      { position: "delantero", label: "Delantero", needed: 1 }
    ]);
    expect(summary.recommendations[0]).toContain("11 jugadores");
    expect(summary.recommendations).toContain("Prioridad: sumar 3 defensores.");
    expect(summary.recommendations).toContain("Faltan 11.4 pagos completos para cubrir la cancha.");
  });

  it("sugiere candidatos activos fuera de la convocatoria para cubrir posiciones faltantes", () => {
    const candidates = buildClubCallupSummary({
      callup: {
        id: "callup-1",
        club_id: "club-1",
        club_team_id: "team-1",
        scheduled_at: "2026-05-16T20:00:00Z",
        opponent_name: null,
        venue: null,
        status: "draft",
        ideal_player_count: 14,
        max_player_count: 16,
        target_payment_count: 14,
        full_payment_cents: 2500000,
        field_cost_cents: 35000000,
        notes: null
      },
      entries: [
        { id: "entry-1", callup_id: "callup-1", club_player_id: "player-1", status: "confirmed", expected_cents: null, notes: null }
      ],
      players: [
        { id: "player-1", club_id: "club-1", full_name: "Arquero", nickname: null, position: "arquero", shirt_number: null, photo_path: null, active: true },
        { id: "player-2", club_id: "club-1", full_name: "Central completo", nickname: null, position: "defensor", shirt_number: null, photo_path: null, active: true },
        { id: "player-3", club_id: "club-1", full_name: "Volante parcial", nickname: null, position: "volante", shirt_number: null, photo_path: null, active: true, default_payment_cents: 1500000 },
        { id: "player-4", club_id: "club-1", full_name: "Inactivo", nickname: null, position: "defensor", shirt_number: null, photo_path: null, active: false }
      ]
    }).candidateSuggestions;

    expect(candidates).toEqual([
      {
        playerId: "player-2",
        displayName: "Central completo",
        position: "defensor",
        positionLabel: "Defensor",
        expectedCents: 2500000,
        paymentEquivalent: 1,
        reason: "Cubre Defensor"
      },
      {
        playerId: "player-3",
        displayName: "Volante parcial",
        position: "volante",
        positionLabel: "Volante",
        expectedCents: 2500000,
        paymentEquivalent: 1,
        reason: "Cubre Volante"
      }
    ]);
  });
});

describe("club team roster options", () => {
  it("separa plantel actual de jugadores disponibles y agrupa candidatos por posicion", () => {
    const options = buildClubTeamRosterOptions({
      teamId: "team-1",
      players: [
        {
          id: "player-1",
          club_id: "club-1",
          full_name: "Arquero Titular",
          nickname: null,
          position: "arquero",
          shirt_number: 1,
          photo_path: null,
          active: true
        },
        {
          id: "player-2",
          club_id: "club-1",
          full_name: "Defensor Libre",
          nickname: null,
          position: "defensor",
          shirt_number: 4,
          photo_path: null,
          active: true
        },
        {
          id: "player-3",
          club_id: "club-1",
          full_name: "Volante Inactivo",
          nickname: null,
          position: "volante",
          shirt_number: 8,
          photo_path: null,
          active: false
        },
        {
          id: "player-4",
          club_id: "club-1",
          full_name: "Delantero Libre",
          nickname: null,
          position: "delantero",
          shirt_number: 9,
          photo_path: null,
          active: true
        }
      ],
      teamPlayers: [
        {
          id: "roster-1",
          club_team_id: "team-1",
          club_player_id: "player-1"
        }
      ]
    });

    expect(options.rosterPlayers.map((player) => player.id)).toEqual(["player-1"]);
    expect(options.availablePlayers.map((player) => player.id)).toEqual(["player-2", "player-4"]);
    expect(options.availableByPosition.defensor.map((player) => player.id)).toEqual(["player-2"]);
    expect(options.availableByPosition.delantero.map((player) => player.id)).toEqual(["player-4"]);
    expect(options.availableByPosition.arquero).toEqual([]);
    expect(options.availableByPosition.volante).toEqual([]);
    expect(options.availableWithoutPosition).toEqual([]);
  });

  it("filtra listas de plantel por busqueda y posicion", () => {
    const players = [
      {
        id: "player-1",
        club_id: "club-1",
        full_name: "Gonzalo Salvador Pefumo",
        nickname: "Cogote",
        position: "defensor" as const,
        shirt_number: 2,
        photo_path: null,
        active: true
      },
      {
        id: "player-2",
        club_id: "club-1",
        full_name: "Federico Estevez",
        nickname: null,
        position: "delantero" as const,
        shirt_number: 9,
        photo_path: null,
        active: true
      },
      {
        id: "player-3",
        club_id: "club-1",
        full_name: "Nicolas Gomez",
        nickname: "Nico",
        position: "arquero" as const,
        shirt_number: 1,
        photo_path: null,
        active: true
      }
    ];

    expect(
      filterClubPlayersForRosterManagement(players, {
        position: "defensor",
        search: "cogo"
      }).map((player) => player.id)
    ).toEqual(["player-1"]);
    expect(
      filterClubPlayersForRosterManagement(players, {
        position: null,
        search: "estevez"
      }).map((player) => player.id)
    ).toEqual(["player-2"]);
  });
});

describe("club public snapshot", () => {
  it("agrega historial, actividad, equipos, jugadores y records excluyendo borradores", () => {
    const snapshot = buildClubPublicSnapshot({
      club,
      players: [
        {
          id: "player-1",
          club_id: "club-1",
          full_name: "Sosa",
          nickname: null,
          position: null,
          shirt_number: null,
          photo_path: null,
          active: true,
          created_at: "2026-04-01T12:00:00Z"
        },
        {
          id: "player-2",
          club_id: "club-1",
          full_name: "Nacho",
          nickname: null,
          position: null,
          shirt_number: null,
          photo_path: null,
          active: true,
          created_at: "2026-04-02T12:00:00Z"
        },
        {
          id: "player-3",
          club_id: "club-1",
          full_name: "Sin jugar",
          nickname: null,
          position: null,
          shirt_number: null,
          photo_path: null,
          active: true,
          created_at: "2026-04-03T12:00:00Z"
        }
      ],
      competitions: [competition],
      teams: [team, reserveTeam],
      teamPlayers: [
        {
          id: "roster-1",
          club_team_id: "team-1",
          club_player_id: "player-1"
        },
        {
          id: "roster-2",
          club_team_id: "team-1",
          club_player_id: "player-2"
        },
        {
          id: "roster-3",
          club_team_id: "team-2",
          club_player_id: "player-2"
        }
      ],
      matches: [
        {
          id: "match-1",
          club_id: "club-1",
          club_team_id: "team-1",
          club_competition_id: "competition-1",
          modality: "11v11",
          played_at: "2026-04-20T20:00:00Z",
          opponent_name: "Rival A",
          venue: null,
          goals_for: 2,
          goals_against: 1,
          status: "played",
          notes: null,
          created_at: "2026-04-20T21:00:00Z"
        },
        {
          id: "match-2",
          club_id: "club-1",
          club_team_id: "team-1",
          club_competition_id: "competition-1",
          modality: "11v11",
          played_at: "2026-04-21T20:00:00Z",
          opponent_name: "Rival B",
          venue: null,
          goals_for: 5,
          goals_against: 0,
          status: "draft",
          notes: null,
          created_at: "2026-04-21T21:00:00Z"
        },
        {
          id: "match-3",
          club_id: "club-1",
          club_team_id: "team-1",
          club_competition_id: "competition-1",
          modality: "11v11",
          played_at: "2026-04-22T20:00:00Z",
          opponent_name: "Rival C",
          venue: null,
          goals_for: 1,
          goals_against: 1,
          status: "played",
          notes: null,
          created_at: "2026-04-22T21:00:00Z"
        },
        {
          id: "match-4",
          club_id: "club-1",
          club_team_id: "team-2",
          club_competition_id: "competition-1",
          modality: "5v5",
          played_at: "2026-04-19T20:00:00Z",
          opponent_name: "Rival D",
          venue: null,
          goals_for: 0,
          goals_against: 2,
          status: "played",
          notes: null,
          created_at: "2026-04-19T21:00:00Z"
        }
      ],
      lineups: [
        {
          id: "lineup-1",
          match_id: "match-1",
          club_player_id: "player-1",
          guest_name: null,
          display_name: "Sosa",
          role: "starter"
        },
        {
          id: "lineup-1b",
          match_id: "match-1",
          club_player_id: "player-2",
          guest_name: null,
          display_name: "Nacho",
          role: "starter"
        },
        {
          id: "lineup-1c",
          match_id: "match-1",
          club_player_id: "player-3",
          guest_name: null,
          display_name: "Sin jugar",
          role: "present"
        },
        {
          id: "lineup-2",
          match_id: "match-2",
          club_player_id: "player-1",
          guest_name: null,
          display_name: "Sosa",
          role: "starter"
        },
        {
          id: "lineup-3",
          match_id: "match-3",
          club_player_id: "player-1",
          guest_name: null,
          display_name: "Sosa",
          role: "starter"
        },
        {
          id: "lineup-3b",
          match_id: "match-3",
          club_player_id: "player-2",
          guest_name: null,
          display_name: "Nacho",
          role: "starter"
        },
        {
          id: "lineup-4",
          match_id: "match-4",
          club_player_id: "player-2",
          guest_name: null,
          display_name: "Nacho",
          role: "starter"
        }
      ],
      stats: [
        {
          id: "stat-1",
          match_id: "match-1",
          lineup_id: "lineup-1",
          goals: 2,
          assists: 1,
          is_mvp: true
        },
        {
          id: "stat-1b",
          match_id: "match-1",
          lineup_id: "lineup-1b",
          goals: 0,
          assists: 1,
          is_mvp: false
        },
        {
          id: "stat-2",
          match_id: "match-2",
          lineup_id: "lineup-2",
          goals: 5,
          assists: 5,
          is_mvp: true
        },
        {
          id: "stat-3",
          match_id: "match-3",
          lineup_id: "lineup-3",
          goals: 0,
          assists: 0,
          is_mvp: false
        },
        {
          id: "stat-3b",
          match_id: "match-3",
          lineup_id: "lineup-3b",
          goals: 1,
          assists: 0,
          is_mvp: true
        },
        {
          id: "stat-4",
          match_id: "match-4",
          lineup_id: "lineup-4",
          goals: 0,
          assists: 0,
          is_mvp: false
        }
      ]
    });

    expect(snapshot.summary).toMatchObject({
      playedMatches: 3,
      goalsFor: 3,
      goalsAgainst: 4,
      totalMatches: 3,
      totalGoals: 3,
      avgGoalsPerMatch: 1,
      totalPlayersDistinct: 3,
      totalAttendances: 6,
      presentNotPlayedCount: 1,
      firstMatchDate: "2026-04-19T20:00:00Z",
      lastMatchDate: "2026-04-22T20:00:00Z"
    });
    expect(snapshot.availableModalities).toEqual(["5v5", "11v11"]);
    expect(snapshot.activity[0]).toMatchObject({
      type: "match_played",
      entityId: "match-3",
      createdAt: "2026-04-22T20:00:00Z"
    });
    expect(snapshot.activity.some((item) => item.entityId === "match-2")).toBe(false);
    expect(snapshot.teams).toEqual([
      {
        id: "team-2",
        name: "La Quinta Reserva",
        shortName: "LQR",
        logoPath: null,
        modality: "5v5",
        players: [
          {
            id: "player-2",
            name: "Nacho",
            position: null,
            shirtNumber: null
          }
        ],
        matches: [
          {
            id: "match-4",
            playedAt: "2026-04-19T20:00:00Z",
            modality: "5v5",
            competitionName: "LAFAB",
            opponentName: "Rival D",
            venue: null,
            goalsFor: 0,
            goalsAgainst: 2
          }
        ],
        playerCount: 1,
        matchesPlayed: 1,
        wins: 0,
        draws: 0,
        losses: 1,
        goalsFor: 0,
        goalsAgainst: 2,
        lastMatchDate: "2026-04-19T20:00:00Z"
      },
      {
        id: "team-1",
        name: "La Quinta Senior",
        shortName: "LQ",
        logoPath: null,
        modality: "11v11",
        players: [
          {
            id: "player-2",
            name: "Nacho",
            position: null,
            shirtNumber: null
          },
          {
            id: "player-1",
            name: "Sosa",
            position: null,
            shirtNumber: null
          }
        ],
        matches: [
          {
            id: "match-3",
            playedAt: "2026-04-22T20:00:00Z",
            modality: "11v11",
            competitionName: "LAFAB",
            opponentName: "Rival C",
            venue: null,
            goalsFor: 1,
            goalsAgainst: 1
          },
          {
            id: "match-1",
            playedAt: "2026-04-20T20:00:00Z",
            modality: "11v11",
            competitionName: "LAFAB",
            opponentName: "Rival A",
            venue: null,
            goalsFor: 2,
            goalsAgainst: 1
          }
        ],
        playerCount: 2,
        matchesPlayed: 2,
        wins: 1,
        draws: 1,
        losses: 0,
        goalsFor: 3,
        goalsAgainst: 2,
        lastMatchDate: "2026-04-22T20:00:00Z"
      }
    ]);
    expect(snapshot.playerStats).toEqual([
      {
        playerId: "player-1",
        name: "Sosa",
        teamNames: ["La Quinta Senior"],
        attendances: 2,
        presentNotPlayed: 0,
        matchesPlayed: 2,
        goals: 2,
        assists: 1,
        mvps: 1,
        lastMatchDate: "2026-04-22T20:00:00Z"
      },
      {
        playerId: "player-2",
        name: "Nacho",
        teamNames: ["La Quinta Reserva", "La Quinta Senior"],
        attendances: 3,
        presentNotPlayed: 0,
        matchesPlayed: 3,
        goals: 1,
        assists: 1,
        mvps: 1,
        lastMatchDate: "2026-04-22T20:00:00Z"
      },
      {
        playerId: "player-3",
        name: "Sin jugar",
        teamNames: ["La Quinta Senior"],
        attendances: 1,
        presentNotPlayed: 1,
        matchesPlayed: 0,
        goals: 0,
        assists: 0,
        mvps: 0,
        lastMatchDate: "2026-04-20T20:00:00Z"
      }
    ]);
    expect(snapshot.records.topScorerAllTime?.playerId).toBe("player-1");
    expect(snapshot.records.topAssistsAllTime?.playerId).toBe("player-1");
    expect(snapshot.records.mostMvps?.playerId).toBe("player-1");
    expect(snapshot.records.mostAttendances?.playerId).toBe("player-2");
    expect(snapshot.records.mostMatchesPlayed?.playerId).toBe("player-2");
    expect(snapshot.records.bestWinStreak).toBeNull();
    expect(snapshot.topScorers).toEqual([
      { name: "Sosa", teamName: "La Quinta Senior", value: 2 },
      { name: "Nacho", teamName: "La Quinta Senior", value: 1 }
    ]);
    expect(snapshot.topAssisters).toEqual([
      { name: "Nacho", teamName: "La Quinta Senior", value: 1 },
      { name: "Sosa", teamName: "La Quinta Senior", value: 1 }
    ]);
    expect(snapshot.topFigures).toEqual([
      { name: "Nacho", teamName: "La Quinta Senior", value: 1 },
      { name: "Sosa", teamName: "La Quinta Senior", value: 1 }
    ]);
    expect(snapshot.competitionStats).toEqual([
      {
        id: "competition-1",
        name: "LAFAB",
        matchesPlayed: 3,
        goalsFor: 3,
        goalsAgainst: 4,
        topScorers: [
          { name: "Sosa", teamName: "La Quinta Senior", value: 2 },
          { name: "Nacho", teamName: "La Quinta Senior", value: 1 }
        ],
        topAssisters: [
          { name: "Nacho", teamName: "La Quinta Senior", value: 1 },
          { name: "Sosa", teamName: "La Quinta Senior", value: 1 }
        ],
        topFigures: [
          { name: "Nacho", teamName: "La Quinta Senior", value: 1 },
          { name: "Sosa", teamName: "La Quinta Senior", value: 1 }
        ]
      }
    ]);
  });

  it("filtra el snapshot publico por modalidad sin reescribir el agregado global", () => {
    const snapshot = buildClubPublicSnapshot({
      club,
      players: [
        {
          id: "player-1",
          club_id: "club-1",
          full_name: "Once",
          nickname: null,
          position: null,
          shirt_number: null,
          photo_path: null,
          active: true,
          created_at: "2026-04-01T12:00:00Z"
        },
        {
          id: "player-2",
          club_id: "club-1",
          full_name: "Cinco",
          nickname: null,
          position: null,
          shirt_number: null,
          photo_path: null,
          active: true,
          created_at: "2026-04-02T12:00:00Z"
        }
      ],
      competitions: [competition],
      teams: [team, reserveTeam],
      teamPlayers: [
        {
          id: "roster-1",
          club_team_id: "team-1",
          club_player_id: "player-1"
        },
        {
          id: "roster-2",
          club_team_id: "team-2",
          club_player_id: "player-2"
        }
      ],
      matches: [
        {
          id: "match-11",
          club_id: "club-1",
          club_team_id: "team-1",
          club_competition_id: "competition-1",
          modality: "11v11",
          played_at: "2026-05-01T20:00:00Z",
          opponent_name: "Rival Once",
          venue: null,
          goals_for: 3,
          goals_against: 1,
          status: "played",
          notes: null
        },
        {
          id: "match-5",
          club_id: "club-1",
          club_team_id: "team-2",
          club_competition_id: "competition-1",
          modality: "5v5",
          played_at: "2026-05-02T20:00:00Z",
          opponent_name: "Rival Cinco",
          venue: null,
          goals_for: 4,
          goals_against: 2,
          status: "played",
          notes: null
        }
      ],
      lineups: [
        {
          id: "lineup-11",
          match_id: "match-11",
          club_player_id: "player-1",
          guest_name: null,
          display_name: "Once",
          role: "starter"
        },
        {
          id: "lineup-5",
          match_id: "match-5",
          club_player_id: "player-2",
          guest_name: null,
          display_name: "Cinco",
          role: "starter"
        }
      ],
      stats: [
        {
          id: "stat-11",
          match_id: "match-11",
          lineup_id: "lineup-11",
          goals: 3,
          assists: 1,
          is_mvp: true
        },
        {
          id: "stat-5",
          match_id: "match-5",
          lineup_id: "lineup-5",
          goals: 4,
          assists: 2,
          is_mvp: false
        }
      ]
    });

    const all = filterClubPublicSnapshotByModality(snapshot, "all");
    const five = filterClubPublicSnapshotByModality(snapshot, "5v5");

    expect(all.summary.totalMatches).toBe(2);
    expect(five.summary).toMatchObject({
      totalMatches: 1,
      goalsFor: 4,
      goalsAgainst: 2,
      totalGoals: 4
    });
    expect(five.teams.map((row) => row.id)).toEqual(["team-2"]);
    expect(five.recentMatches.map((row) => row.id)).toEqual(["match-5"]);
    expect(five.playerStats.map((row) => row.playerId)).toEqual(["player-2"]);
    expect(five.topScorers).toEqual([{ name: "Cinco", teamName: "La Quinta Reserva", value: 4 }]);
  });
});
