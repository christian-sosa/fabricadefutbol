import { describe, expect, it } from "vitest";

import { buildClubPublicSnapshot, validateClubMatchSheet } from "@/lib/domain/clubs";

const club = {
  id: "club-1",
  name: "La Quinta",
  slug: "la-quinta",
  description: null,
  home_venue: null,
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
  active: true
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

  it("rechaza planillas sin exactamente 11 titulares", () => {
    const errors = validateClubMatchSheet({
      goalsFor: 1,
      goalsAgainst: 0,
      participants: Array.from({ length: 10 }, (_, index) => ({
        playerId: `player-${index + 1}`,
        role: "starter" as const,
        goals: 0,
        assists: 0
      }))
    });

    expect(errors).toContain("El partido debe tener exactamente 11 titulares.");
  });

  it("rechaza goles y asistencias mayores a los goles a favor", () => {
    const participants = Array.from({ length: 11 }, (_, index) => ({
      playerId: `player-${index + 1}`,
      role: "starter" as const,
      goals: index < 3 ? 1 : 0,
      assists: index < 3 ? 1 : 0
    }));

    const errors = validateClubMatchSheet({
      goalsFor: 2,
      goalsAgainst: 0,
      participants
    });

    expect(errors).toContain("La suma de goleadores no puede superar los goles a favor.");
    expect(errors).toContain("La suma de asistencias no puede superar los goles a favor.");
  });
});

describe("club public snapshot", () => {
  it("agrega solo partidos jugados para goleadores, asistidores y figuras", () => {
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
          active: true
        }
      ],
      competitions: [competition],
      teams: [team],
      teamPlayers: [
        {
          id: "roster-1",
          club_team_id: "team-1",
          club_player_id: "player-1"
        }
      ],
      matches: [
        {
          id: "match-1",
          club_id: "club-1",
          club_team_id: "team-1",
          club_competition_id: "competition-1",
          played_at: "2026-04-20T20:00:00Z",
          opponent_name: "Rival A",
          venue: null,
          goals_for: 2,
          goals_against: 1,
          status: "played",
          notes: null
        },
        {
          id: "match-2",
          club_id: "club-1",
          club_team_id: "team-1",
          club_competition_id: "competition-1",
          played_at: "2026-04-21T20:00:00Z",
          opponent_name: "Rival B",
          venue: null,
          goals_for: 5,
          goals_against: 0,
          status: "draft",
          notes: null
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
          match_id: "match-2",
          club_player_id: "player-1",
          guest_name: null,
          display_name: "Sosa",
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
          id: "stat-2",
          match_id: "match-2",
          lineup_id: "lineup-2",
          goals: 5,
          assists: 5,
          is_mvp: true
        }
      ]
    });

    expect(snapshot.summary.playedMatches).toBe(1);
    expect(snapshot.summary.goalsFor).toBe(2);
    expect(snapshot.topScorers).toEqual([{ name: "Sosa", teamName: "La Quinta Senior", value: 2 }]);
    expect(snapshot.topAssisters).toEqual([{ name: "Sosa", teamName: "La Quinta Senior", value: 1 }]);
    expect(snapshot.topFigures).toEqual([{ name: "Sosa", teamName: "La Quinta Senior", value: 1 }]);
    expect(snapshot.competitionStats).toEqual([
      {
        id: "competition-1",
        name: "LAFAB",
        matchesPlayed: 1,
        goalsFor: 2,
        goalsAgainst: 1,
        topScorers: [{ name: "Sosa", teamName: "La Quinta Senior", value: 2 }],
        topAssisters: [{ name: "Sosa", teamName: "La Quinta Senior", value: 1 }],
        topFigures: [{ name: "Sosa", teamName: "La Quinta Senior", value: 1 }]
      }
    ]);
  });
});
