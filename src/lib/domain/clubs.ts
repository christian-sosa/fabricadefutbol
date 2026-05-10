import { MATCH_MODALITIES, TEAM_SIZE_BY_MODALITY } from "@/lib/constants";
import type { MatchModality } from "@/types/domain";

export type ClubStatus = "draft" | "active" | "archived";
export type ClubMatchStatus = "draft" | "played" | "cancelled";
export type ClubLineupRole = "starter" | "substitute" | "present";
export type ClubPaymentStatus = "paid" | "partial" | "unpaid";
export type ClubSnapshotModalityFilter = MatchModality | "all";
export const CLUB_PLAYER_POSITIONS = ["arquero", "defensor", "volante", "delantero"] as const;
export type ClubPlayerPosition = (typeof CLUB_PLAYER_POSITIONS)[number];

const CLUB_PLAYER_POSITION_LABELS: Record<ClubPlayerPosition, string> = {
  arquero: "Arquero",
  defensor: "Defensor",
  volante: "Volante",
  delantero: "Delantero"
};

export type ClubRecord = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  home_venue: string | null;
  logo_path: string | null;
  is_public: boolean;
  status: ClubStatus;
  created_at: string;
};

export type ClubPlayerRecord = {
  id: string;
  club_id: string;
  full_name: string;
  nickname: string | null;
  position: ClubPlayerPosition | null;
  shirt_number: number | null;
  photo_path: string | null;
  notes?: string | null;
  active: boolean;
  created_at?: string;
};

export type ClubCompetitionRecord = {
  id: string;
  club_id: string;
  name: string;
  slug: string;
  active: boolean;
  notes: string | null;
};

export type ClubTeamRecord = {
  id: string;
  club_id: string;
  name: string;
  short_name: string | null;
  logo_path: string | null;
  modality: MatchModality;
  active: boolean;
  notes?: string | null;
  created_at?: string;
};

export type ClubTeamPlayerRecord = {
  id: string;
  club_team_id: string;
  club_player_id: string;
};

export type ClubMatchRecord = {
  id: string;
  club_id: string;
  club_team_id: string;
  club_competition_id: string | null;
  modality: MatchModality;
  played_at: string;
  opponent_name: string;
  venue: string | null;
  goals_for: number;
  goals_against: number;
  status: ClubMatchStatus;
  notes: string | null;
  field_cost_cents?: number;
  field_cost_currency?: string;
  created_at?: string;
};

export type ClubLineupRecord = {
  id: string;
  match_id: string;
  club_player_id: string | null;
  guest_name: string | null;
  display_name: string;
  role: ClubLineupRole;
};

export type ClubMatchPlayerStatRecord = {
  id: string;
  match_id: string;
  lineup_id: string;
  goals: number;
  assists: number;
  is_mvp: boolean;
};

export type ClubMatchPaymentRecord = {
  id: string;
  match_id: string;
  lineup_id: string;
  expected_cents: number;
  paid_cents: number;
  paid_at: string | null;
  notes: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ClubFinancialTotals = {
  matchCount: number;
  totalCostCents: number;
  expectedCents: number;
  paidCents: number;
  pendingCents: number;
};

export type ClubFinancialMatchRow = {
  matchId: string;
  opponentName: string;
  playedAt: string;
  participantCount: number;
  costCents: number;
  expectedCents: number;
  paidCents: number;
  pendingCents: number;
  status: ClubPaymentStatus;
};

export type ClubFinancialPlayerRow = {
  key: string;
  playerId: string | null;
  displayName: string;
  matchCount: number;
  expectedCents: number;
  paidCents: number;
  pendingCents: number;
  status: ClubPaymentStatus;
};

export type ClubFinancialSummary = {
  totals: ClubFinancialTotals;
  matches: ClubFinancialMatchRow[];
  players: ClubFinancialPlayerRow[];
};

export type ClubPublicSummary = {
  clubName: string;
  teamCount: number;
  playerCount: number;
  playedMatches: number;
  goalsFor: number;
  goalsAgainst: number;
  totalMatches: number;
  totalGoals: number;
  avgGoalsPerMatch: number;
  totalPlayersDistinct: number;
  totalAttendances: number;
  presentNotPlayedCount: number;
  firstMatchDate: string | null;
  lastMatchDate: string | null;
};

export type ClubPublicTeam = {
  id: string;
  name: string;
  shortName: string | null;
  logoPath: string | null;
  modality: MatchModality;
  players: ClubPublicTeamPlayer[];
  matches: ClubPublicTeamMatch[];
  playerCount: number;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  lastMatchDate: string | null;
};

export type ClubPublicTeamPlayer = {
  id: string;
  name: string;
  position: ClubPlayerPosition | null;
  shirtNumber: number | null;
};

export type ClubPublicTeamMatch = {
  id: string;
  playedAt: string;
  modality: MatchModality;
  competitionName: string;
  opponentName: string;
  venue: string | null;
  goalsFor: number;
  goalsAgainst: number;
};

export type ClubPublicMatch = {
  id: string;
  playedAt: string;
  modality: MatchModality;
  teamId: string;
  teamName: string;
  competitionId: string | null;
  competitionName: string;
  opponentName: string;
  venue: string | null;
  goalsFor: number;
  goalsAgainst: number;
};

export type ClubPublicStatRow = {
  name: string;
  teamName: string;
  value: number;
};

export type ClubPublicCompetitionStat = {
  id: string | null;
  name: string;
  matchesPlayed: number;
  goalsFor: number;
  goalsAgainst: number;
  topScorers: ClubPublicStatRow[];
  topAssisters: ClubPublicStatRow[];
  topFigures: ClubPublicStatRow[];
};

export type ClubPublicActivityType = "match_played" | "player_added_to_club" | "team_created";

export type ClubPublicActivity = {
  type: ClubPublicActivityType;
  title: string;
  description: string;
  createdAt: string;
  entityId: string;
};

export type ClubPublicPlayerStat = {
  playerId: string;
  name: string;
  teamNames: string[];
  attendances: number;
  presentNotPlayed: number;
  matchesPlayed: number;
  goals: number;
  assists: number;
  mvps: number;
  lastMatchDate: string | null;
};

export type ClubPublicRecords = {
  topScorerAllTime: ClubPublicPlayerStat | null;
  topAssistsAllTime: ClubPublicPlayerStat | null;
  mostMvps: ClubPublicPlayerStat | null;
  mostAttendances: ClubPublicPlayerStat | null;
  mostMatchesPlayed: ClubPublicPlayerStat | null;
  bestWinStreak: null;
};

export type ClubPublicSnapshotCore = {
  summary: ClubPublicSummary;
  activity: ClubPublicActivity[];
  teams: ClubPublicTeam[];
  recentMatches: ClubPublicMatch[];
  playerStats: ClubPublicPlayerStat[];
  records: ClubPublicRecords;
  topScorers: ClubPublicStatRow[];
  topAssisters: ClubPublicStatRow[];
  topFigures: ClubPublicStatRow[];
  competitionStats: ClubPublicCompetitionStat[];
};

export type ClubPublicSnapshot = ClubPublicSnapshotCore & {
  availableModalities: MatchModality[];
  byModality: Partial<Record<MatchModality, ClubPublicSnapshotCore>>;
};

export type ClubMatchSheetParticipantInput = {
  playerId?: string | null;
  guestName?: string | null;
  role: ClubLineupRole;
  goals: number;
  assists: number;
  isMvp?: boolean;
};

export type ClubMatchSheetInput = {
  modality: MatchModality;
  goalsFor: number;
  goalsAgainst: number;
  participants: ClubMatchSheetParticipantInput[];
};

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}

function toSafeCents(value: unknown) {
  const amount = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(amount)) return 0;
  return Math.max(0, Math.trunc(amount));
}

function getAggregateStatus(expectedCents: number, paidCents: number): ClubPaymentStatus {
  if (expectedCents <= 0 || paidCents >= expectedCents) return "paid";
  if (paidCents <= 0) return "unpaid";
  return "partial";
}

export function splitClubMatchCost(totalCents: number, lineupIds: string[]) {
  const normalizedTotal = toSafeCents(totalCents);
  if (!lineupIds.length) return [];

  const baseShare = Math.floor(normalizedTotal / lineupIds.length);
  const remainder = normalizedTotal % lineupIds.length;

  return lineupIds.map((lineupId, index) => ({
    lineupId,
    expectedCents: baseShare + (index < remainder ? 1 : 0)
  }));
}

export function getClubPaymentStatus(payment: Pick<ClubMatchPaymentRecord, "expected_cents" | "paid_cents">): ClubPaymentStatus {
  return getAggregateStatus(toSafeCents(payment.expected_cents), toSafeCents(payment.paid_cents));
}

export function buildClubFinancialSummary({
  lineups,
  matches,
  payments
}: {
  lineups: ClubLineupRecord[];
  matches: ClubMatchRecord[];
  payments: ClubMatchPaymentRecord[];
}): ClubFinancialSummary {
  const playedMatches = matches.filter((match) => match.status === "played");
  const matchesById = new Map(playedMatches.map((match) => [match.id, match]));
  const lineupsById = new Map(lineups.map((lineup) => [lineup.id, lineup]));
  const paymentsByMatch = new Map<string, ClubMatchPaymentRecord[]>();
  const playersByKey = new Map<ClubFinancialPlayerRow["key"], ClubFinancialPlayerRow>();

  for (const payment of payments) {
    if (!matchesById.has(payment.match_id)) continue;
    const matchPayments = paymentsByMatch.get(payment.match_id) ?? [];
    matchPayments.push(payment);
    paymentsByMatch.set(payment.match_id, matchPayments);

    const lineup = lineupsById.get(payment.lineup_id);
    if (!lineup) continue;

    const key = lineup.club_player_id
      ? `player:${lineup.club_player_id}`
      : `guest:${normalizeKey(lineup.display_name) || lineup.id}`;
    const expectedCents = toSafeCents(payment.expected_cents);
    const paidCents = toSafeCents(payment.paid_cents);
    const existing = playersByKey.get(key) ?? {
      key,
      playerId: lineup.club_player_id,
      displayName: lineup.display_name,
      matchCount: 0,
      expectedCents: 0,
      paidCents: 0,
      pendingCents: 0,
      status: "unpaid" as ClubPaymentStatus
    };

    existing.matchCount += 1;
    existing.expectedCents += expectedCents;
    existing.paidCents += paidCents;
    existing.pendingCents += Math.max(0, expectedCents - paidCents);
    existing.status = getAggregateStatus(existing.expectedCents, existing.paidCents);
    playersByKey.set(key, existing);
  }

  const matchRows = playedMatches
    .map((match) => {
      const matchPayments = paymentsByMatch.get(match.id) ?? [];
      const expectedCents = matchPayments.reduce((total, payment) => total + toSafeCents(payment.expected_cents), 0);
      const paidCents = matchPayments.reduce((total, payment) => total + toSafeCents(payment.paid_cents), 0);
      const pendingCents = Math.max(0, expectedCents - paidCents);

      return {
        matchId: match.id,
        opponentName: match.opponent_name,
        playedAt: match.played_at,
        participantCount: matchPayments.length,
        costCents: toSafeCents(match.field_cost_cents),
        expectedCents,
        paidCents,
        pendingCents,
        status: getAggregateStatus(expectedCents, paidCents)
      };
    })
    .filter((row) => row.costCents > 0 || row.expectedCents > 0 || row.paidCents > 0)
    .sort((left, right) => compareDateDesc(left.playedAt, right.playedAt));

  const players = Array.from(playersByKey.values()).sort((left, right) => {
    if (right.pendingCents !== left.pendingCents) return right.pendingCents - left.pendingCents;
    if (right.expectedCents !== left.expectedCents) return right.expectedCents - left.expectedCents;
    return left.displayName.localeCompare(right.displayName, "es");
  });

  return {
    totals: {
      matchCount: matchRows.length,
      totalCostCents: matchRows.reduce((total, match) => total + match.costCents, 0),
      expectedCents: matchRows.reduce((total, match) => total + match.expectedCents, 0),
      paidCents: matchRows.reduce((total, match) => total + match.paidCents, 0),
      pendingCents: matchRows.reduce((total, match) => total + match.pendingCents, 0)
    },
    matches: matchRows,
    players
  };
}

export function normalizeClubPlayerPosition(value: unknown): ClubPlayerPosition | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return CLUB_PLAYER_POSITIONS.includes(normalized as ClubPlayerPosition)
    ? (normalized as ClubPlayerPosition)
    : null;
}

export function formatClubPlayerPosition(value: string | null | undefined) {
  const normalized = normalizeClubPlayerPosition(value);
  return normalized ? CLUB_PLAYER_POSITION_LABELS[normalized] : value?.trim() || "";
}

export function buildClubTeamRosterOptions({
  players,
  teamId,
  teamPlayers
}: {
  players: ClubPlayerRecord[];
  teamId: string;
  teamPlayers: ClubTeamPlayerRecord[];
}) {
  const rosterIds = new Set(
    teamPlayers
      .filter((row) => row.club_team_id === teamId)
      .map((row) => row.club_player_id)
  );
  const rosterPlayers = players
    .filter((player) => rosterIds.has(player.id))
    .sort((left, right) => left.full_name.localeCompare(right.full_name, "es"));
  const availablePlayers = players
    .filter((player) => player.active && !rosterIds.has(player.id))
    .sort((left, right) => left.full_name.localeCompare(right.full_name, "es"));
  const availableByPosition = Object.fromEntries(
    CLUB_PLAYER_POSITIONS.map((position) => [
      position,
      availablePlayers.filter((player) => player.position === position)
    ])
  ) as Record<ClubPlayerPosition, ClubPlayerRecord[]>;
  const availableWithoutPosition = availablePlayers.filter((player) => !player.position);

  return {
    rosterIds,
    rosterPlayers,
    availablePlayers,
    availableByPosition,
    availableWithoutPosition
  };
}

export function filterClubPlayersForRosterManagement(
  players: ClubPlayerRecord[],
  filters: {
    position: ClubPlayerPosition | null;
    search?: string | null;
  }
) {
  const search = normalizeKey(filters.search ?? "");
  return players.filter((player) => {
    if (filters.position && player.position !== filters.position) return false;
    if (!search) return true;
    return [
      player.full_name,
      player.nickname,
      player.notes,
      player.shirt_number ? String(player.shirt_number) : null
    ]
      .filter(Boolean)
      .some((value) => normalizeKey(String(value)).includes(search));
  });
}

function compareByValueThenName(left: ClubPublicStatRow, right: ClubPublicStatRow) {
  if (right.value !== left.value) return right.value - left.value;
  return left.name.localeCompare(right.name, "es");
}

function createStatAccumulator() {
  return new Map<string, ClubPublicStatRow>();
}

function toTopRows(accumulator: Map<string, ClubPublicStatRow>) {
  return Array.from(accumulator.values()).sort(compareByValueThenName).slice(0, 10);
}

function compareDateAsc(left: string, right: string) {
  return new Date(left).getTime() - new Date(right).getTime();
}

function compareDateDesc(left: string, right: string) {
  return new Date(right).getTime() - new Date(left).getTime();
}

function comparePlayerStats(left: ClubPublicPlayerStat, right: ClubPublicPlayerStat) {
  if (right.goals !== left.goals) return right.goals - left.goals;
  if (right.assists !== left.assists) return right.assists - left.assists;
  if (right.mvps !== left.mvps) return right.mvps - left.mvps;
  if (right.matchesPlayed !== left.matchesPlayed) return right.matchesPlayed - left.matchesPlayed;
  return left.name.localeCompare(right.name, "es");
}

function pickRecord(
  rows: ClubPublicPlayerStat[],
  metric: "goals" | "assists" | "mvps" | "attendances" | "matchesPlayed"
) {
  const [record] = rows
    .filter((row) => row[metric] > 0)
    .sort((left, right) => {
      if (right[metric] !== left[metric]) return right[metric] - left[metric];
      return comparePlayerStats(left, right);
    });

  return record ?? null;
}

function addStatValue(params: {
  accumulator: Map<string, ClubPublicStatRow>;
  name: string;
  teamName: string;
  value: number;
}) {
  if (params.value <= 0) return;
  const key = `${normalizeKey(params.name)}::${normalizeKey(params.teamName)}`;
  const existing = params.accumulator.get(key);
  if (existing) {
    existing.value += params.value;
    return;
  }

  params.accumulator.set(key, {
    name: params.name,
    teamName: params.teamName,
    value: params.value
  });
}

function compareModality(left: MatchModality, right: MatchModality) {
  return MATCH_MODALITIES.indexOf(left) - MATCH_MODALITIES.indexOf(right);
}

export function validateClubMatchSheet(input: ClubMatchSheetInput) {
  const errors: string[] = [];
  const starters = input.participants.filter((participant) => participant.role === "starter");
  const expectedStarters = TEAM_SIZE_BY_MODALITY[input.modality];
  const duplicatePlayerIds = new Set<string>();
  const seenPlayerIds = new Set<string>();
  let goalsTotal = 0;
  let assistsTotal = 0;
  let mvpTotal = 0;

  if (!Number.isInteger(input.goalsFor) || input.goalsFor < 0) {
    errors.push("Los goles a favor deben ser un numero entero mayor o igual a 0.");
  }

  if (!Number.isInteger(input.goalsAgainst) || input.goalsAgainst < 0) {
    errors.push("Los goles en contra deben ser un numero entero mayor o igual a 0.");
  }

  if (starters.length !== expectedStarters) {
    errors.push(`El partido ${input.modality} debe tener exactamente ${expectedStarters} titulares.`);
  }

  for (const participant of input.participants) {
    const playerId = participant.playerId?.trim() || null;
    const guestName = participant.guestName?.trim() || null;

    if (!playerId && !guestName) {
      errors.push("Cada participante debe ser un jugador del club o un invitado.");
    }

    if (playerId && guestName) {
      errors.push("Un participante no puede ser jugador del club e invitado a la vez.");
    }

    if (playerId) {
      if (seenPlayerIds.has(playerId)) {
        duplicatePlayerIds.add(playerId);
      }
      seenPlayerIds.add(playerId);
    }

    if (!Number.isInteger(participant.goals) || participant.goals < 0) {
      errors.push("Los goles de cada participante deben ser enteros mayores o iguales a 0.");
    }

    if (!Number.isInteger(participant.assists) || participant.assists < 0) {
      errors.push("Las asistencias de cada participante deben ser enteros mayores o iguales a 0.");
    }

    if (participant.role === "present") {
      if (participant.goals > 0 || participant.assists > 0 || participant.isMvp) {
        errors.push("Un jugador que fue pero no entro no puede tener goles, asistencias ni figura.");
      }
    }

    goalsTotal += Math.max(0, participant.goals);
    assistsTotal += Math.max(0, participant.assists);
    if (participant.isMvp) mvpTotal += 1;
  }

  if (duplicatePlayerIds.size > 0) {
    errors.push("Un jugador del club no puede cargarse dos veces en el mismo partido.");
  }

  if (goalsTotal > input.goalsFor) {
    errors.push("La suma de goleadores no puede superar los goles a favor.");
  }

  if (assistsTotal > input.goalsFor) {
    errors.push("La suma de asistencias no puede superar los goles a favor.");
  }

  if (mvpTotal > 1) {
    errors.push("Solo puede haber una figura por partido.");
  }

  return errors;
}

type ClubPublicSnapshotInput = {
  club: ClubRecord;
  players: ClubPlayerRecord[];
  competitions: ClubCompetitionRecord[];
  teams: ClubTeamRecord[];
  teamPlayers: ClubTeamPlayerRecord[];
  matches: ClubMatchRecord[];
  lineups: ClubLineupRecord[];
  stats: ClubMatchPlayerStatRecord[];
};

function buildClubPublicSnapshotCore(
  params: ClubPublicSnapshotInput,
  modalityFilter?: MatchModality
): ClubPublicSnapshotCore {
  const activeTeams = params.teams.filter((team) => team.active && (!modalityFilter || team.modality === modalityFilter));
  const activeTeamIds = new Set(activeTeams.map((team) => team.id));
  const competitionsById = new Map(params.competitions.map((competition) => [competition.id, competition]));
  const teamsById = new Map(params.teams.map((team) => [team.id, team]));
  const playersById = new Map(params.players.map((player) => [player.id, player]));
  const playedMatches = params.matches
    .filter((match) => match.status === "played" && (!modalityFilter || match.modality === modalityFilter))
    .sort((left, right) => new Date(right.played_at).getTime() - new Date(left.played_at).getTime());
  const playedMatchIds = new Set(playedMatches.map((match) => match.id));
  const playedMatchDatesAscending = playedMatches.map((match) => match.played_at).sort(compareDateAsc);
  const playedMatchesByTeam = new Map<
    string,
    {
      matchesPlayed: number;
      wins: number;
      draws: number;
      losses: number;
      goalsFor: number;
      goalsAgainst: number;
      lastMatchDate: string | null;
    }
  >();

  for (const match of playedMatches) {
    const current = playedMatchesByTeam.get(match.club_team_id) ?? {
      matchesPlayed: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      lastMatchDate: null
    };
    current.matchesPlayed += 1;
    current.goalsFor += Number(match.goals_for);
    current.goalsAgainst += Number(match.goals_against);
    if (Number(match.goals_for) > Number(match.goals_against)) current.wins += 1;
    if (Number(match.goals_for) === Number(match.goals_against)) current.draws += 1;
    if (Number(match.goals_for) < Number(match.goals_against)) current.losses += 1;
    if (!current.lastMatchDate || compareDateDesc(match.played_at, current.lastMatchDate) < 0) {
      current.lastMatchDate = match.played_at;
    }
    playedMatchesByTeam.set(match.club_team_id, current);
  }

  const playerCountByTeam = new Map<string, number>();
  const rosterTeamNamesByPlayerId = new Map<string, Set<string>>();
  const playersByTeam = new Map<string, ClubPublicTeamPlayer[]>();
  const visibleActivePlayerIds = new Set<string>();
  for (const teamPlayer of params.teamPlayers) {
    if (!activeTeamIds.has(teamPlayer.club_team_id)) continue;
    const player = playersById.get(teamPlayer.club_player_id);
    if (player?.active) {
      visibleActivePlayerIds.add(player.id);
      playerCountByTeam.set(
        teamPlayer.club_team_id,
        (playerCountByTeam.get(teamPlayer.club_team_id) ?? 0) + 1
      );
      const teamPlayers = playersByTeam.get(teamPlayer.club_team_id) ?? [];
      teamPlayers.push({
        id: player.id,
        name: player.full_name,
        position: normalizeClubPlayerPosition(player.position),
        shirtNumber: player.shirt_number
      });
      playersByTeam.set(teamPlayer.club_team_id, teamPlayers);
    }
    const teamName = teamsById.get(teamPlayer.club_team_id)?.name;
    if (teamName) {
      const teamNames = rosterTeamNamesByPlayerId.get(teamPlayer.club_player_id) ?? new Set<string>();
      teamNames.add(teamName);
      rosterTeamNamesByPlayerId.set(teamPlayer.club_player_id, teamNames);
    }
  }
  const visibleActivePlayers = params.players.filter((player) =>
    player.active && (!modalityFilter || visibleActivePlayerIds.has(player.id))
  );

  const lineupById = new Map(params.lineups.map((lineup) => [lineup.id, lineup]));
  const matchById = new Map(params.matches.map((match) => [match.id, match]));
  const playerStatsById = new Map<
    string,
    ClubPublicPlayerStat & {
      matchIds: Set<string>;
      attendanceMatchIds: Set<string>;
      teamNamesSet: Set<string>;
    }
  >();
  const scorers = createStatAccumulator();
  const assisters = createStatAccumulator();
  const figures = createStatAccumulator();
  const competitionStatsById = new Map<
    string,
    {
      id: string | null;
      name: string;
      matchesPlayed: number;
      goalsFor: number;
      goalsAgainst: number;
      scorers: Map<string, ClubPublicStatRow>;
      assisters: Map<string, ClubPublicStatRow>;
      figures: Map<string, ClubPublicStatRow>;
    }
  >();

  function getCompetitionAccumulator(match: ClubMatchRecord) {
    const competition = match.club_competition_id ? competitionsById.get(match.club_competition_id) ?? null : null;
    const key = competition?.id ?? "without-competition";
    const existing = competitionStatsById.get(key);
    if (existing) return existing;

    const created = {
      id: competition?.id ?? null,
      name: competition?.name ?? "Sin torneo",
      matchesPlayed: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      scorers: createStatAccumulator(),
      assisters: createStatAccumulator(),
      figures: createStatAccumulator()
    };
    competitionStatsById.set(key, created);
    return created;
  }

  function getPlayerAccumulator(lineup: ClubLineupRecord, match: ClubMatchRecord) {
    if (!lineup.club_player_id) return null;
    const playerId = lineup.club_player_id;
    const player = playersById.get(playerId);
    const existing = playerStatsById.get(playerId);
    if (existing) return existing;

    const created = {
      playerId,
      name: player?.full_name ?? lineup.display_name,
      teamNames: [],
      teamNamesSet: new Set<string>(),
      matchIds: new Set<string>(),
      attendanceMatchIds: new Set<string>(),
      attendances: 0,
      presentNotPlayed: 0,
      matchesPlayed: 0,
      goals: 0,
      assists: 0,
      mvps: 0,
      lastMatchDate: null
    };
    for (const teamName of rosterTeamNamesByPlayerId.get(playerId) ?? []) {
      created.teamNamesSet.add(teamName);
    }
    const matchTeamName = teamsById.get(match.club_team_id)?.name;
    if (matchTeamName) created.teamNamesSet.add(matchTeamName);
    playerStatsById.set(playerId, created);
    return created;
  }

  for (const match of playedMatches) {
    const competitionStats = getCompetitionAccumulator(match);
    competitionStats.matchesPlayed += 1;
    competitionStats.goalsFor += Number(match.goals_for);
    competitionStats.goalsAgainst += Number(match.goals_against);
  }

  for (const lineup of params.lineups) {
    if (!playedMatchIds.has(lineup.match_id)) continue;
    const match = matchById.get(lineup.match_id);
    if (!match || !lineup.club_player_id) continue;
    const playerStats = getPlayerAccumulator(lineup, match);
    if (!playerStats) continue;
    if (!playerStats.attendanceMatchIds.has(match.id)) {
      playerStats.attendanceMatchIds.add(match.id);
      playerStats.attendances += 1;
    }
    if (lineup.role === "present") {
      playerStats.presentNotPlayed += 1;
    } else if (!playerStats.matchIds.has(match.id)) {
      playerStats.matchIds.add(match.id);
      playerStats.matchesPlayed += 1;
    }
    const matchTeamName = teamsById.get(match.club_team_id)?.name;
    if (matchTeamName) playerStats.teamNamesSet.add(matchTeamName);
    if (!playerStats.lastMatchDate || compareDateDesc(match.played_at, playerStats.lastMatchDate) < 0) {
      playerStats.lastMatchDate = match.played_at;
    }
  }

  for (const stat of params.stats) {
    if (!playedMatchIds.has(stat.match_id)) continue;
    const lineup = lineupById.get(stat.lineup_id);
    const match = matchById.get(stat.match_id);
    if (!lineup || !match) continue;
    if (lineup.role === "present") continue;
    const teamName = teamsById.get(match.club_team_id)?.name ?? "Equipo";
    const competitionStats = getCompetitionAccumulator(match);
    const playerStats = getPlayerAccumulator(lineup, match);
    if (playerStats) {
      playerStats.goals += Number(stat.goals);
      playerStats.assists += Number(stat.assists);
      if (stat.is_mvp) playerStats.mvps += 1;
    }

    addStatValue({
      accumulator: scorers,
      name: lineup.display_name,
      teamName,
      value: stat.goals
    });
    addStatValue({
      accumulator: competitionStats.scorers,
      name: lineup.display_name,
      teamName,
      value: stat.goals
    });
    addStatValue({
      accumulator: assisters,
      name: lineup.display_name,
      teamName,
      value: stat.assists
    });
    addStatValue({
      accumulator: competitionStats.assisters,
      name: lineup.display_name,
      teamName,
      value: stat.assists
    });
    addStatValue({
      accumulator: figures,
      name: lineup.display_name,
      teamName,
      value: stat.is_mvp ? 1 : 0
    });
    addStatValue({
      accumulator: competitionStats.figures,
      name: lineup.display_name,
      teamName,
      value: stat.is_mvp ? 1 : 0
    });
  }

  const playerStats = Array.from(playerStatsById.values())
    .map((row) => ({
      playerId: row.playerId,
      name: row.name,
      teamNames: Array.from(row.teamNamesSet).sort((left, right) => left.localeCompare(right, "es")),
      attendances: row.attendances,
      presentNotPlayed: row.presentNotPlayed,
      matchesPlayed: row.matchesPlayed,
      goals: row.goals,
      assists: row.assists,
      mvps: row.mvps,
      lastMatchDate: row.lastMatchDate
    }))
    .sort(comparePlayerStats);

  const summary: ClubPublicSummary = {
    clubName: params.club.name,
    teamCount: activeTeams.length,
    playerCount: visibleActivePlayers.length,
    playedMatches: playedMatches.length,
    goalsFor: playedMatches.reduce((total, match) => total + Number(match.goals_for), 0),
    goalsAgainst: playedMatches.reduce((total, match) => total + Number(match.goals_against), 0),
    totalMatches: playedMatches.length,
    totalGoals: playedMatches.reduce((total, match) => total + Number(match.goals_for), 0),
    avgGoalsPerMatch:
      playedMatches.length > 0
        ? Number((playedMatches.reduce((total, match) => total + Number(match.goals_for), 0) / playedMatches.length).toFixed(2))
        : 0,
    totalPlayersDistinct: visibleActivePlayers.length,
    totalAttendances: playerStats.reduce((total, player) => total + player.attendances, 0),
    presentNotPlayedCount: playerStats.reduce((total, player) => total + player.presentNotPlayed, 0),
    firstMatchDate: playedMatchDatesAscending[0] ?? null,
    lastMatchDate: playedMatches[0]?.played_at ?? null
  };

  const activity: ClubPublicActivity[] = [
    ...playedMatches.map((match) => ({
      type: "match_played" as const,
      title: `${teamsById.get(match.club_team_id)?.name ?? "Equipo"} vs ${match.opponent_name}`,
      description: `${match.goals_for} - ${match.goals_against} - ${match.modality}`,
      createdAt: match.played_at,
      entityId: match.id
    })),
    ...params.players
      .filter((player) => Boolean(player.created_at) && (!modalityFilter || visibleActivePlayerIds.has(player.id)))
      .map((player) => ({
        type: "player_added_to_club" as const,
        title: player.full_name,
        description: "Jugador agregado al club",
        createdAt: player.created_at as string,
        entityId: player.id
      })),
    ...params.teams
      .filter((team) => Boolean(team.created_at) && (!modalityFilter || team.modality === modalityFilter))
      .map((team) => ({
        type: "team_created" as const,
        title: team.name,
        description: "Equipo creado",
        createdAt: team.created_at as string,
        entityId: team.id
      }))
  ]
    .sort((left, right) => compareDateDesc(left.createdAt, right.createdAt))
    .slice(0, 12);

  const records: ClubPublicRecords = {
    topScorerAllTime: pickRecord(playerStats, "goals"),
    topAssistsAllTime: pickRecord(playerStats, "assists"),
    mostMvps: pickRecord(playerStats, "mvps"),
    mostAttendances: pickRecord(playerStats, "attendances"),
    mostMatchesPlayed: pickRecord(playerStats, "matchesPlayed"),
    bestWinStreak: null
  };

  return {
    summary,
    activity,
    teams: activeTeams
      .map((team) => {
        const metrics = playedMatchesByTeam.get(team.id) ?? {
          matchesPlayed: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          lastMatchDate: null
        };

        return {
          id: team.id,
          name: team.name,
          shortName: team.short_name,
          logoPath: params.club.logo_path,
          modality: team.modality,
          players: (playersByTeam.get(team.id) ?? []).sort((left, right) => left.name.localeCompare(right.name, "es")),
          matches: playedMatches
            .filter((match) => match.club_team_id === team.id)
            .map((match) => ({
              id: match.id,
              playedAt: match.played_at,
              modality: match.modality,
              competitionName: match.club_competition_id
                ? competitionsById.get(match.club_competition_id)?.name ?? "Torneo"
                : "Sin torneo",
              opponentName: match.opponent_name,
              venue: match.venue,
              goalsFor: Number(match.goals_for),
              goalsAgainst: Number(match.goals_against)
            })),
          playerCount: playerCountByTeam.get(team.id) ?? 0,
          ...metrics
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name, "es")),
    recentMatches: playedMatches.slice(0, 10).map((match) => ({
      id: match.id,
      playedAt: match.played_at,
      modality: match.modality,
      teamId: match.club_team_id,
      teamName: teamsById.get(match.club_team_id)?.name ?? "Equipo",
      competitionId: match.club_competition_id,
      competitionName: match.club_competition_id
        ? competitionsById.get(match.club_competition_id)?.name ?? "Torneo"
        : "Sin torneo",
      opponentName: match.opponent_name,
      venue: match.venue,
      goalsFor: Number(match.goals_for),
      goalsAgainst: Number(match.goals_against)
    })),
    playerStats,
    records,
    topScorers: toTopRows(scorers),
    topAssisters: toTopRows(assisters),
    topFigures: toTopRows(figures),
    competitionStats: Array.from(competitionStatsById.values())
      .map((competition) => ({
        id: competition.id,
        name: competition.name,
        matchesPlayed: competition.matchesPlayed,
        goalsFor: competition.goalsFor,
        goalsAgainst: competition.goalsAgainst,
        topScorers: toTopRows(competition.scorers),
        topAssisters: toTopRows(competition.assisters),
        topFigures: toTopRows(competition.figures)
      }))
      .sort((left, right) => {
        if (right.matchesPlayed !== left.matchesPlayed) return right.matchesPlayed - left.matchesPlayed;
        return left.name.localeCompare(right.name, "es");
      })
  };
}

export function buildClubPublicSnapshot(params: ClubPublicSnapshotInput): ClubPublicSnapshot {
  const core = buildClubPublicSnapshotCore(params);
  const availableModalities = Array.from(
    new Set([
      ...params.teams.filter((team) => team.active).map((team) => team.modality),
      ...params.matches.filter((match) => match.status === "played").map((match) => match.modality)
    ])
  ).sort(compareModality);
  const byModality = Object.fromEntries(
    availableModalities.map((modality) => [modality, buildClubPublicSnapshotCore(params, modality)])
  ) as Partial<Record<MatchModality, ClubPublicSnapshotCore>>;

  return {
    ...core,
    availableModalities,
    byModality
  };
}

export function filterClubPublicSnapshotByModality(
  snapshot: ClubPublicSnapshot,
  modality: ClubSnapshotModalityFilter
): ClubPublicSnapshot {
  if (modality === "all") return snapshot;
  const core = snapshot.byModality?.[modality];
  if (!core && snapshot.availableModalities.length === 1 && snapshot.availableModalities[0] === modality) {
    return snapshot;
  }
  if (!core) {
    return {
      ...snapshot,
      summary: {
        ...snapshot.summary,
        teamCount: 0,
        playerCount: 0,
        playedMatches: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        totalMatches: 0,
        totalGoals: 0,
        avgGoalsPerMatch: 0,
        totalPlayersDistinct: 0,
        totalAttendances: 0,
        presentNotPlayedCount: 0,
        firstMatchDate: null,
        lastMatchDate: null
      },
      activity: [],
      teams: [],
      recentMatches: [],
      playerStats: [],
      records: {
        topScorerAllTime: null,
        topAssistsAllTime: null,
        mostMvps: null,
        mostAttendances: null,
        mostMatchesPlayed: null,
        bestWinStreak: null
      },
      topScorers: [],
      topAssisters: [],
      topFigures: [],
      competitionStats: []
    };
  }

  return {
    ...core,
    availableModalities: snapshot.availableModalities ?? [],
    byModality: snapshot.byModality ?? {}
  };
}
