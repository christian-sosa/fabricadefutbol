type RoundRobinTeam = {
  id: string;
  name: string;
};

export type GeneratedTournamentRound = {
  roundNumber: number;
  name: string;
  matches: Array<{
    matchNumber: number;
    homeTeamId: string;
    awayTeamId: string;
  }>;
};

type TeamSlot = RoundRobinTeam | null;

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

export function generateRoundRobinFixture(teams: RoundRobinTeam[]): GeneratedTournamentRound[] {
  if (teams.length < 2) {
    throw new Error("Necesitas al menos 2 equipos para generar el fixture.");
  }

  const initialSlots: TeamSlot[] = [...teams];
  if (initialSlots.length % 2 === 1) {
    initialSlots.push(null);
  }

  const totalRounds = initialSlots.length - 1;
  const matchesPerRound = initialSlots.length / 2;
  let currentSlots = [...initialSlots];
  const rounds: GeneratedTournamentRound[] = [];

  for (let roundIndex = 0; roundIndex < totalRounds; roundIndex += 1) {
    const roundMatches: GeneratedTournamentRound["matches"] = [];

    for (let pairIndex = 0; pairIndex < matchesPerRound; pairIndex += 1) {
      const left = currentSlots[pairIndex];
      const right = currentSlots[currentSlots.length - 1 - pairIndex];

      if (!left || !right) continue;

      const swap = shouldSwapHomeAway(roundIndex, pairIndex);
      roundMatches.push({
        matchNumber: pairIndex + 1,
        homeTeamId: swap ? right.id : left.id,
        awayTeamId: swap ? left.id : right.id
      });
    }

    rounds.push({
      roundNumber: roundIndex + 1,
      name: `Fecha ${roundIndex + 1}`,
      matches: roundMatches
    });

    currentSlots = rotateTeamSlots(currentSlots);
  }

  return rounds;
}
