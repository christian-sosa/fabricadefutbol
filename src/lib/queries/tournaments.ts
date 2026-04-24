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
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
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

type TournamentTeamCaptainRow = {
  id: string;
  tournament_id: string;
  team_id: string;
  captain_id: string;
  created_at: string;
};

type TournamentAdminRow = {
  id: string;
  tournament_id: string;
  admin_id: string;
  role: "owner" | "editor";
  created_at: string;
};

type TournamentAdminInviteRow = {
  id: string;
  tournament_id: string;
  email: string;
  invite_token: string;
  expires_at: string;
  created_at: string;
  status: "pending" | "accepted" | "revoked";
};

type TournamentCaptainInviteRow = {
  id: string;
  tournament_id: string;
  team_id: string;
  email: string;
  invite_token: string;
  expires_at: string;
  created_at: string;
};

type AdminProfileRow = {
  id: string;
  display_name: string;
};

function isMissingSupabaseTableError(error: { code?: string | null; message: string } | null | undefined) {
  if (!error) return false;
  const code = error.code?.trim().toUpperCase();
  const message = error.message.toLowerCase();
  return (
    code === "PGRST205" ||
    (message.includes("could not find the table") && message.includes("schema cache"))
  );
}

async function resolveAdminEmailsById(adminIds: string[]) {
  const adminClient = createSupabaseAdminClient();
  const emailsById = new Map<string, string>();
  if (!adminClient || !adminIds.length) {
    return emailsById;
  }

  const { data: authUsers, error } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000
  });

  if (error) {
    throw new Error(error.message);
  }

  for (const user of authUsers?.users ?? []) {
    if (!adminIds.includes(user.id)) continue;
    if (!user.email) continue;
    emailsById.set(user.id, user.email.toLowerCase());
  }

  return emailsById;
}

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

async function getTournamentAdminData(tournamentId: string) {
  const supabase = await createSupabaseServerClient();
  const [{ data: adminRows, error: adminRowsError }, inviteRowsResult] = await Promise.all([
    supabase
      .from("tournament_admins")
      .select("id, tournament_id, admin_id, role, created_at")
      .eq("tournament_id", tournamentId)
      .order("created_at", { ascending: true }),
    supabase
      .from("tournament_admin_invites")
      .select("id, tournament_id, email, invite_token, expires_at, created_at, status")
      .eq("tournament_id", tournamentId)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
  ]);

  if (adminRowsError) throw new Error(adminRowsError.message);
  const supportsTournamentAdminInvites = !isMissingSupabaseTableError(inviteRowsResult.error);
  if (inviteRowsResult.error && supportsTournamentAdminInvites) {
    throw new Error(inviteRowsResult.error.message);
  }
  const inviteRows = supportsTournamentAdminInvites ? inviteRowsResult.data ?? [] : [];

  const uniqueAdminIds = Array.from(new Set((adminRows ?? []).map((row) => row.admin_id)));
  const [{ data: profiles, error: profilesError }, emailsById] = await Promise.all([
    uniqueAdminIds.length
      ? supabase.from("admins").select("id, display_name").in("id", uniqueAdminIds)
      : Promise.resolve({ data: [], error: null }),
    resolveAdminEmailsById(uniqueAdminIds)
  ]);

  if (profilesError) throw new Error(profilesError.message);

  const profilesById = new Map(((profiles ?? []) as AdminProfileRow[]).map((profile) => [profile.id, profile]));

  return {
    admins: ((adminRows ?? []) as TournamentAdminRow[]).map((row) => ({
      id: row.admin_id,
      membershipId: row.id,
      displayName: profilesById.get(row.admin_id)?.display_name ?? "Admin",
      email: emailsById.get(row.admin_id) ?? null,
      role: row.role,
      createdAt: row.created_at
    })),
    pendingInvites: ((inviteRows ?? []) as TournamentAdminInviteRow[]).map((row) => ({
      id: row.id,
      tournamentId: row.tournament_id,
      email: row.email,
      inviteToken: row.invite_token,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      status: row.status
    })),
    schemaSupport: {
      tournamentAdminInvites: supportsTournamentAdminInvites
    }
  };
}

export async function getAdminTournamentDetails(tournamentId: string) {
  noStore();
  const bundle = await loadTournamentBundle(tournamentId);
  if (!bundle.tournament) return null;

  const supabase = await createSupabaseServerClient();
  const [
    teamCaptainRowsResult,
    captainInviteRowsResult,
    tournamentAdminData
  ] = await Promise.all([
    supabase
      .from("tournament_team_captains")
      .select("id, tournament_id, team_id, captain_id, created_at")
      .eq("tournament_id", tournamentId),
    supabase
      .from("tournament_captain_invites")
      .select("id, tournament_id, team_id, email, invite_token, expires_at, created_at")
      .eq("tournament_id", tournamentId)
      .order("created_at", { ascending: false }),
    getTournamentAdminData(tournamentId)
  ]);

  const supportsTournamentTeamCaptains = !isMissingSupabaseTableError(teamCaptainRowsResult.error);
  const supportsTournamentCaptainInvites = !isMissingSupabaseTableError(captainInviteRowsResult.error);
  if (teamCaptainRowsResult.error && supportsTournamentTeamCaptains) {
    throw new Error(teamCaptainRowsResult.error.message);
  }
  if (captainInviteRowsResult.error && supportsTournamentCaptainInvites) {
    throw new Error(captainInviteRowsResult.error.message);
  }

  const teamCaptainRows = supportsTournamentTeamCaptains ? teamCaptainRowsResult.data ?? [] : [];
  const captainInviteRows = supportsTournamentCaptainInvites ? captainInviteRowsResult.data ?? [] : [];

  const captainIds = Array.from(new Set(teamCaptainRows.map((row) => row.captain_id)));
  const { data: captainProfiles, error: captainProfilesError } = captainIds.length
    ? await supabase.from("admins").select("id, display_name").in("id", captainIds)
    : { data: [], error: null };

  if (captainProfilesError) throw new Error(captainProfilesError.message);

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

  const captainProfilesById = new Map(
    ((captainProfiles ?? []) as AdminProfileRow[]).map((profile) => [profile.id, profile])
  );
  const teamCaptainsByTeam = new Map(
    ((teamCaptainRows ?? []) as TournamentTeamCaptainRow[]).map((captainRow) => [
      captainRow.team_id,
      {
        id: captainRow.id,
        tournamentId: captainRow.tournament_id,
        teamId: captainRow.team_id,
        captainId: captainRow.captain_id,
        displayName: captainProfilesById.get(captainRow.captain_id)?.display_name ?? "Capitan",
        createdAt: captainRow.created_at
      }
    ])
  );
  const captainInvitesByTeam = new Map(
    ((captainInviteRows ?? []) as TournamentCaptainInviteRow[]).map((inviteRow) => [
      inviteRow.team_id,
      {
        id: inviteRow.id,
        tournamentId: inviteRow.tournament_id,
        teamId: inviteRow.team_id,
        email: inviteRow.email,
        inviteToken: inviteRow.invite_token,
        expiresAt: inviteRow.expires_at,
        createdAt: inviteRow.created_at
      }
    ])
  );

  return {
    tournament: normalizeTournamentRecord(bundle.tournament as TournamentRecord),
    teams: bundle.teams,
    rounds: bundle.rounds,
    players: bundle.players,
    playersByTeam,
    tournamentAdmins: tournamentAdminData,
    teamCaptainsByTeam,
    captainInvitesByTeam,
    schemaSupport: {
      tournamentAdminInvites: tournamentAdminData.schemaSupport.tournamentAdminInvites,
      tournamentTeamCaptains: supportsTournamentTeamCaptains,
      tournamentCaptainInvites: supportsTournamentCaptainInvites
    },
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

export async function getCaptainTournamentTeamPanelData(params: {
  tournamentId: string;
  teamId: string;
}) {
  noStore();

  const { tournamentId, teamId } = params;
  const bundle = await loadTournamentBundle(tournamentId);
  if (!bundle.tournament) return null;

  const team = bundle.teams.find((row) => row.id === teamId) ?? null;
  if (!team) return null;

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
  const teamMatches = fixture.filter((match) => match.homeTeamId === teamId || match.awayTeamId === teamId);
  const roster = bundle.players
    .filter((player) => player.team_id === teamId)
    .sort((left, right) => left.full_name.localeCompare(right.full_name, "es"));

  return {
    tournament: normalizeTournamentRecord(bundle.tournament as TournamentRecord),
    team,
    roster,
    standings,
    standingRow: standings.find((row) => row.teamId === teamId) ?? null,
    teamMatches
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
