import type { CompetitionPhase, TournamentByeKind } from "@/types/domain";

type FixtureTeam = {
  id: string;
  name: string;
};

export type GeneratedTournamentMatch = {
  matchNumber: number;
  homeTeamId: string;
  awayTeamId: string;
};

export type GeneratedTournamentBye = {
  byeNumber: number;
  teamId: string;
  kind: TournamentByeKind;
};

export type GeneratedTournamentRound = {
  roundNumber: number;
  name: string;
  phase: CompetitionPhase;
  stageLabel: string;
  matches: GeneratedTournamentMatch[];
  byes: GeneratedTournamentBye[];
};

type TeamSlot = FixtureTeam | null;

function rotateTeamSlots(slots: TeamSlot[]) {
  if (slots.length <= 2) return slots;

  const [fixed, ...rest] = slots;
  const last = rest.pop() ?? null;
  return [fixed ?? null, last, ...rest];
}

function shouldSwapHomeAway(roundIndex: number, pairIndex: number) {
  if (pairIndex === 0) {
    return roundIndex % 2 === 1;
  }

  return pairIndex % 2 === 0;
}

function nextPowerOfTwo(value: number) {
  let current = 1;
  while (current < value) {
    current *= 2;
  }
  return current;
}

export function shuffleTournamentTeams<T>(teams: T[], random = Math.random) {
  const shuffled = [...teams];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const nextIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[nextIndex]] = [shuffled[nextIndex], shuffled[index]];
  }

  return shuffled;
}

export function buildPlayoffPairingOrder<T>(teams: T[]) {
  const ordered: T[] = [];
  let leftIndex = 0;
  let rightIndex = teams.length - 1;

  while (leftIndex <= rightIndex) {
    if (leftIndex === rightIndex) {
      ordered.push(teams[leftIndex]);
      break;
    }

    ordered.push(teams[leftIndex], teams[rightIndex]);
    leftIndex += 1;
    rightIndex -= 1;
  }

  return ordered;
}

export function getKnockoutStageLabel(bracketSize: number) {
  switch (bracketSize) {
    case 2:
      return "Final";
    case 4:
      return "Semifinal";
    case 8:
      return "Cuartos";
    case 16:
      return "Octavos";
    default:
      return `Llave de ${bracketSize}`;
  }
}

export function generateRoundRobinFixture(
  teams: FixtureTeam[],
  options?: {
    phase?: CompetitionPhase;
    startRoundNumber?: number;
  }
): GeneratedTournamentRound[] {
  if (teams.length < 2) {
    throw new Error("Necesitas al menos 2 equipos para generar el fixture.");
  }

  const phase = options?.phase ?? "league";
  const roundOffset = Math.max(0, options?.startRoundNumber ?? 1) - 1;
  const initialSlots: TeamSlot[] = [...teams];
  if (initialSlots.length % 2 === 1) {
    initialSlots.push(null);
  }

  const totalRounds = initialSlots.length - 1;
  const matchesPerRound = initialSlots.length / 2;
  let currentSlots = [...initialSlots];
  const rounds: GeneratedTournamentRound[] = [];

  for (let roundIndex = 0; roundIndex < totalRounds; roundIndex += 1) {
    const roundMatches: GeneratedTournamentMatch[] = [];
    const roundByes: GeneratedTournamentBye[] = [];

    for (let pairIndex = 0; pairIndex < matchesPerRound; pairIndex += 1) {
      const left = currentSlots[pairIndex];
      const right = currentSlots[currentSlots.length - 1 - pairIndex];

      if (!left || !right) {
        const byeTeam = left ?? right;
        if (byeTeam) {
          roundByes.push({
            byeNumber: roundByes.length + 1,
            teamId: byeTeam.id,
            kind: "free_round"
          });
        }
        continue;
      }

      const swap = shouldSwapHomeAway(roundIndex, pairIndex);
      roundMatches.push({
        matchNumber: pairIndex + 1,
        homeTeamId: swap ? right.id : left.id,
        awayTeamId: swap ? left.id : right.id
      });
    }

    const roundNumber = roundOffset + roundIndex + 1;
    rounds.push({
      roundNumber,
      name: `Fecha ${roundNumber}`,
      phase,
      stageLabel: `Fecha ${roundNumber}`,
      matches: roundMatches,
      byes: roundByes
    });

    currentSlots = rotateTeamSlots(currentSlots);
  }

  return rounds;
}

export function generateKnockoutStage(
  teams: FixtureTeam[],
  options?: {
    phase?: CompetitionPhase;
    roundNumber?: number;
    stageLabel?: string;
  }
): GeneratedTournamentRound {
  if (teams.length < 2) {
    throw new Error("Necesitas al menos 2 equipos para generar una llave.");
  }

  const phase = options?.phase ?? "cup";
  const bracketSize = nextPowerOfTwo(teams.length);
  const matches: GeneratedTournamentMatch[] = [];
  const byes: GeneratedTournamentBye[] = [];
  const byeCount = bracketSize - teams.length;
  let teamIndex = 0;

  for (let pairIndex = 0; pairIndex < bracketSize / 2; pairIndex += 1) {
    const home = teams[teamIndex] ?? null;
    teamIndex += 1;
    let away: FixtureTeam | null = null;

    if (pairIndex < byeCount) {
    } else {
      away = teams[teamIndex] ?? null;
      teamIndex += 1;
    }

    if (!home || !away) {
      const byeTeam = home ?? away;
      if (byeTeam) {
        byes.push({
          byeNumber: byes.length + 1,
          teamId: byeTeam.id,
          kind: "advance"
        });
      }
      continue;
    }

    matches.push({
      matchNumber: matches.length + 1,
      homeTeamId: home.id,
      awayTeamId: away.id
    });
  }

  const stageLabel = options?.stageLabel ?? getKnockoutStageLabel(bracketSize);
  const roundNumber = options?.roundNumber ?? 1;

  return {
    roundNumber,
    name: stageLabel,
    phase,
    stageLabel,
    matches,
    byes
  };
}
