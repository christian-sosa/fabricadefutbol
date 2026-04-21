import { unstable_noStore as noStore } from "next/cache";

import { requireAdminSession } from "@/lib/auth/admin";
import { getAdminTournaments } from "@/lib/auth/tournaments";
import {
  buildTournamentBestDefense,
  buildTournamentFixture,
  buildTournamentStandings,
  buildTournamentTopFigures,
  buildTournamentTopScorers,
  type TournamentMatchPlayerStatReference,
  type TournamentMatchReference,
  type TournamentMatchResultReference,
  type TournamentRoundReference,
  type TournamentTeamReference
} from "@/lib/domain/tournament-stats";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  TournamentBestDefenseRow,
  TournamentFixtureRow,
  TournamentListItem,
  TournamentTopFigureRow,
  TournamentTopScorerRow
} from "@/types/domain";

type TournamentRecord = {
  id: string;
  name: string;
  slug: string;
  season_label: string;
  description: string | null;
  is_public: boolean;
  status: TournamentListItem["status"];
  created_at: string;
};

function normalizeTournamentRecord(record: TournamentRecord): TournamentListItem {
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    seasonLabel: record.season_label,
    description: record.description,
    isPublic: record.is_public,
    status: record.status,
    createdAt: record.created_at
  };
}

async function loadTournamentBundle(tournamentId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: tournament, error: tournamentError } = await supabase
    .from("tournaments")
    .select("id, name, slug, season_label, description, is_public, status, created_at")
    .eq("id", tournamentId)
    .maybeSingle();

  if (tournamentError) throw new Error(tournamentError.message);

  const { data: matches, error: matchesError } = await supabase
    .from("tournament_matches")
    .select("id, round_id, home_team_id, away_team_id, scheduled_at, venue, status")
    .eq("tournament_id", tournamentId);

  if (matchesError) throw new Error(matchesError.message);

  const matchIds = (matches ?? []).map((row) => row.id);
  const [
    { data: teams, error: teamsError },
    { data: rounds, error: roundsError },
    { data: results, error: resultsError },
    { data: playerStats, error: playerStatsError },
    { data: players, error: playersError }
  ] = await Promise.all([
    supabase
      .from("tournament_teams")
      .select("id, name, short_name, display_order, notes")
      .eq("tournament_id", tournamentId)
      .order("display_order", { ascending: true }),
    supabase
      .from("tournament_rounds")
      .select("id, round_number, name, starts_at, ends_at")
      .eq("tournament_id", tournamentId)
      .order("round_number", { ascending: true }),
    matchIds.length
      ? supabase
          .from("tournament_match_results")
          .select("match_id, home_score, away_score, mvp_player_id, mvp_player_name, notes")
          .in("match_id", matchIds)
      : Promise.resolve({ data: [], error: null }),
    matchIds.length
      ? supabase
          .from("tournament_match_player_stats")
          .select("match_id, team_id, player_id, player_name, goals, yellow_cards, red_cards, is_mvp")
          .in("match_id", matchIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("tournament_players")
      .select("id, team_id, full_name, shirt_number, position, active")
      .eq("tournament_id", tournamentId)
      .order("full_name", { ascending: true })
  ]);

  if (teamsError) throw new Error(teamsError.message);
  if (roundsError) throw new Error(roundsError.message);
  if (resultsError) throw new Error(resultsError.message);
  if (playerStatsError) throw new Error(playerStatsError.message);
  if (playersError) throw new Error(playersError.message);

  return {
    tournament,
    teams: ((teams ?? []) as TournamentTeamReference[]).map((team) => ({
      ...team,
      display_order: Number(team.display_order)
    })),
    rounds: (rounds ?? []) as TournamentRoundReference[],
    matches: (matches ?? []) as TournamentMatchReference[],
    results: (results ?? []) as TournamentMatchResultReference[],
    playerStats: (playerStats ?? []) as TournamentMatchPlayerStatReference[],
    players: players ?? []
  };
}

export async function getPublicTournaments(): Promise<TournamentListItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tournaments")
    .select("id, name, slug, season_label, description, is_public, status, created_at")
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return ((data ?? []) as TournamentRecord[]).map(normalizeTournamentRecord);
}

export async function getPublicTournamentBySlug(slug: string) {
  noStore();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tournaments")
    .select("id, name, slug, season_label, description, is_public, status, created_at")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const bundle = await loadTournamentBundle(data.id);
  const fixture = buildTournamentFixture({
    teams: bundle.teams,
    rounds: bundle.rounds,
    matches: bundle.matches,
    results: bundle.results
  });

  return {
    tournament: normalizeTournamentRecord(data as TournamentRecord),
    teams: bundle.teams,
    players: bundle.players,
    standings: buildTournamentStandings({
      teams: bundle.teams,
      matches: bundle.matches,
      results: bundle.results
    }),
    fixture,
    topScorers: buildTournamentTopScorers({
      teams: bundle.teams,
      playerStats: bundle.playerStats
    }),
    topFigures: buildTournamentTopFigures({
      teams: bundle.teams,
      playerStats: bundle.playerStats
    }),
    bestDefense: buildTournamentBestDefense({
      teams: bundle.teams,
      matches: bundle.matches,
      results: bundle.results
    })
  };
}

export async function getPublicTournamentMatchDetails(params: {
  slug: string;
  matchId: string;
}) {
  const { slug, matchId } = params;
  const tournamentData = await getPublicTournamentBySlug(slug);
  if (!tournamentData) return null;

  const match = tournamentData.fixture.find((row) => row.id === matchId) ?? null;
  if (!match) return null;

  const bundle = await loadTournamentBundle(tournamentData.tournament.id);
  const result = bundle.results.find((row) => row.match_id === matchId) ?? null;
  const teamById = new Map(bundle.teams.map((team) => [team.id, team]));
  const stats = bundle.playerStats
    .filter((row) => row.match_id === matchId)
    .map((row) => ({
      ...row,
      teamName: teamById.get(row.team_id)?.name ?? "Equipo",
      teamShortName: teamById.get(row.team_id)?.short_name ?? null
    }));

  return {
    tournament: tournamentData.tournament,
    match,
    result,
    homeStats: stats.filter((row) => row.team_id === match.homeTeamId),
    awayStats: stats.filter((row) => row.team_id === match.awayTeamId)
  };
}

export async function getAdminTournamentList() {
  const admin = await requireAdminSession();
  const tournaments = await getAdminTournaments(admin);
  return tournaments.map((tournament) => ({
    id: tournament.id,
    name: tournament.name,
    slug: tournament.slug,
    seasonLabel: tournament.season_label,
    description: null,
    isPublic: tournament.is_public,
    status: tournament.status,
    createdAt: tournament.created_at
  }));
}

export async function getAdminTournamentDetails(tournamentId: string) {
  noStore();
  const bundle = await loadTournamentBundle(tournamentId);
  if (!bundle.tournament) return null;

  const standings = buildTournamentStandings({
    teams: bundle.teams,
    matches: bundle.matches,
    results: bundle.results
  });
  const fixture = buildTournamentFixture({
    teams: bundle.teams,
    rounds: bundle.rounds,
    matches: bundle.matches,
    results: bundle.results
  });

  const playersByTeam = new Map<string, typeof bundle.players>();
  for (const player of bundle.players) {
    const current = playersByTeam.get(player.team_id) ?? [];
    current.push(player);
    playersByTeam.set(player.team_id, current);
  }

  return {
    tournament: normalizeTournamentRecord(bundle.tournament as TournamentRecord),
    teams: bundle.teams,
    rounds: bundle.rounds,
    players: bundle.players,
    playersByTeam,
    matches: bundle.matches,
    results: bundle.results,
    playerStats: bundle.playerStats,
    fixture,
    standings,
    topScorers: buildTournamentTopScorers({
      teams: bundle.teams,
      playerStats: bundle.playerStats
    }),
    topFigures: buildTournamentTopFigures({
      teams: bundle.teams,
      playerStats: bundle.playerStats
    }),
    bestDefense: buildTournamentBestDefense({
      teams: bundle.teams,
      matches: bundle.matches,
      results: bundle.results
    })
  };
}

export async function getAdminTournamentMatchSheetData(params: {
  tournamentId: string;
  matchId: string;
}) {
  const { tournamentId, matchId } = params;
  const details = await getAdminTournamentDetails(tournamentId);
  if (!details) return null;

  const match = details.fixture.find((row) => row.id === matchId) ?? null;
  if (!match) return null;

  const teamPlayers = details.players.filter(
    (player) => player.team_id === match.homeTeamId || player.team_id === match.awayTeamId
  );
  const result = details.results.find((row) => row.match_id === matchId) ?? null;
  const stats = details.playerStats.filter((row) => row.match_id === matchId);
  const statsByKey = new Map(
    stats.map((row) => [`${row.team_id}:${row.player_id ?? row.player_name.toLowerCase()}`, row])
  );

  return {
    tournament: details.tournament,
    match,
    result,
    registeredPlayers: teamPlayers.map((player) => {
      const key = `${player.team_id}:${player.id}`;
      const stat = statsByKey.get(key) ?? null;
      return {
        id: player.id,
        teamId: player.team_id,
        fullName: player.full_name,
        shirtNumber: player.shirt_number,
        position: player.position,
        active: player.active,
        goals: stat?.goals ?? 0,
        yellowCards: stat?.yellow_cards ?? 0,
        redCards: stat?.red_cards ?? 0,
        isMvp: Boolean(stat?.is_mvp)
      };
    }),
    extraStats: stats
      .filter((row) => !row.player_id)
      .map((row) => ({
        teamId: row.team_id,
        playerName: row.player_name,
        goals: row.goals,
        yellowCards: row.yellow_cards,
        redCards: row.red_cards,
        isMvp: row.is_mvp
      }))
  };
}

export function groupFixtureByRound(fixture: TournamentFixtureRow[]) {
  const rounds = new Map<
    string,
    {
      roundNumber: number;
      roundName: string;
      matches: TournamentFixtureRow[];
    }
  >();

  for (const match of fixture) {
    const key = `${match.roundNumber}:${match.roundName}`;
    const current = rounds.get(key) ?? {
      roundNumber: match.roundNumber,
      roundName: match.roundName,
      matches: []
    };
    current.matches.push(match);
    rounds.set(key, current);
  }

  return [...rounds.values()].sort((left, right) => left.roundNumber - right.roundNumber);
}

export function findTopScorerRows(rows: TournamentTopScorerRow[]) {
  if (!rows.length) return [] as TournamentTopScorerRow[];
  const topGoals = rows[0]?.goals ?? 0;
  return rows.filter((row) => row.goals === topGoals);
}

export function findTopFigureRows(rows: TournamentTopFigureRow[]) {
  if (!rows.length) return [] as TournamentTopFigureRow[];
  const topCount = rows[0]?.mvpCount ?? 0;
  return rows.filter((row) => row.mvpCount === topCount);
}

export function findBestDefenseRows(rows: TournamentBestDefenseRow[]) {
  if (!rows.length) return [] as TournamentBestDefenseRow[];
  const bestValue = rows[0]?.goalsAgainst ?? 0;
  return rows.filter((row) => row.goalsAgainst === bestValue);
}
