import { unstable_noStore as noStore } from "next/cache";

import { requireAdminSession } from "@/lib/auth/admin";
import { getAdminLeagues } from "@/lib/auth/tournaments";
import {
  resolveLeagueWriteWindow
} from "@/lib/domain/billing";
import {
  buildTournamentBestDefense,
  buildTournamentFixture,
  buildTournamentStandings,
  buildTournamentTopFigures,
  buildTournamentTopScorers,
  type TournamentByeReference,
  type TournamentMatchPlayerStatReference,
  type TournamentMatchReference,
  type TournamentMatchResultReference,
  type TournamentRoundReference,
  type TournamentTeamReference
} from "@/lib/domain/tournament-stats";
import { getLeaguePhotoUrl } from "@/lib/league-photos";
import { getLeagueLogoUrl } from "@/lib/league-logos";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTeamLogoUrl } from "@/lib/team-logos";
import type {
  CompetitionCoverageMode,
  CompetitionListItem,
  CompetitionPlayoffSize,
  LeagueListItem,
  TournamentBestDefenseRow,
  TournamentFixtureRow,
  TournamentTopFigureRow,
  TournamentTopScorerRow
} from "@/types/domain";

type LeagueRecord = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_path: string | null;
  photo_path: string | null;
  venue_name: string | null;
  location_notes: string | null;
  is_public: boolean;
  status: LeagueListItem["status"];
  created_at: string;
};

type CompetitionRecord = {
  id: string;
  league_id: string;
  name: string;
  slug: string;
  season_label: string;
  description: string | null;
  venue_override: string | null;
  type: CompetitionListItem["type"];
  coverage_mode: CompetitionCoverageMode;
  playoff_size: number | null;
  is_public: boolean;
  status: CompetitionListItem["status"];
  created_at: string;
};

type LeagueTeamRecord = {
  id: string;
  league_id: string;
  name: string;
  short_name: string | null;
  slug: string;
  logo_path: string | null;
  notes: string | null;
  created_at: string;
};

type CompetitionTeamRecord = {
  id: string;
  competition_id: string;
  league_team_id: string;
  display_name: string;
  short_name: string | null;
  logo_path: string | null;
  display_order: number;
  notes: string | null;
  created_at: string;
};

type CompetitionRoundRecord = TournamentRoundReference & {
  competition_id: string;
};

type CompetitionByeRecord = TournamentByeReference & {
  competition_id: string;
  created_at: string;
};

type CompetitionMatchRecord = TournamentMatchReference & {
  competition_id: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type CompetitionMatchResultRecord = TournamentMatchResultReference & {
  updated_at: string;
};

type CompetitionMatchPlayerStatRecord = TournamentMatchPlayerStatReference & {
  updated_at: string;
};

type CompetitionTeamCaptainRow = {
  id: string;
  competition_id: string;
  competition_team_id: string;
  captain_id: string;
  created_at: string;
};

type CompetitionCaptainInviteRow = {
  id: string;
  competition_id: string;
  competition_team_id: string;
  email: string;
  invite_token: string;
  expires_at: string;
  created_at: string;
};

type CompetitionTeamPlayerRow = {
  id: string;
  competition_team_id: string;
  full_name: string;
  shirt_number: number | null;
  position: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type LeagueAdminRow = {
  id: string;
  league_id: string;
  admin_id: string;
  role: "owner" | "editor";
  created_at: string;
};

type LeagueAdminInviteRow = {
  id: string;
  league_id: string;
  email: string;
  invite_token: string;
  expires_at: string;
  created_at: string;
  status: "pending" | "accepted" | "revoked";
};

type LeagueBillingSubscriptionRow = {
  league_id: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  last_payment_at: string | null;
};

type AdminProfileRow = {
  id: string;
  display_name: string;
};

type LeagueTeamListItem = {
  id: string;
  leagueId: string;
  name: string;
  shortName: string | null;
  slug: string;
  logoUrl: string | null;
  notes: string | null;
  createdAt: string;
};

type CompetitionTeamListItem = {
  id: string;
  competitionId: string;
  leagueTeamId: string;
  displayName: string;
  shortName: string | null;
  logoUrl: string | null;
  displayOrder: number;
  notes: string | null;
  createdAt: string;
};

type CompetitionPlayerListItem = {
  id: string;
  competitionTeamId: string;
  fullName: string;
  shirtNumber: number | null;
  position: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type LeagueAdminListItem = {
  id: string;
  membershipId: string;
  displayName: string;
  email: string | null;
  role: "owner" | "editor";
  createdAt: string;
};

type LeagueAdminInviteListItem = {
  id: string;
  leagueId: string;
  email: string;
  inviteToken: string;
  expiresAt: string;
  createdAt: string;
  status: "pending" | "accepted" | "revoked";
};

type CompetitionBundleCore = {
  league: LeagueListItem;
  competition: CompetitionListItem;
  competitionTeams: CompetitionTeamListItem[];
  rounds: CompetitionRoundRecord[];
  byes: CompetitionByeRecord[];
  matches: CompetitionMatchRecord[];
  results: CompetitionMatchResultRecord[];
  playerStats: CompetitionMatchPlayerStatRecord[];
  standings: ReturnType<typeof buildTournamentStandings>;
  fixture: TournamentFixtureRow[];
  topScorers: TournamentTopScorerRow[];
  topFigures: TournamentTopFigureRow[];
  bestDefense: TournamentBestDefenseRow[];
};

type CompetitionBundleWithPlayers = CompetitionBundleCore & {
  players: CompetitionPlayerListItem[];
  playersByTeam: Map<string, CompetitionPlayerListItem[]>;
};

function normalizePlayoffSize(value: number | null): CompetitionPlayoffSize | null {
  return value === 4 || value === 8 ? value : null;
}

function isPublicTournamentStatus(status: string) {
  return status === "active" || status === "finished";
}

function isLeagueBillingSchemaMissing(message: string) {
  return /league_billing_subscriptions|league_billing_payments|purpose|period_start|period_end|subscription_applied_at/i.test(
    message
  );
}

function normalizeLeagueRecord(
  record: LeagueRecord,
  counts?: {
    teamCount?: number;
    competitionCount?: number;
  }
): LeagueListItem {
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    description: record.description,
    logoUrl: getLeagueLogoUrl(record.id),
    photoUrl: record.photo_path ? getLeaguePhotoUrl(record.id) : null,
    venueName: record.venue_name,
    locationNotes: record.location_notes,
    isPublic: record.is_public,
    status: record.status,
    createdAt: record.created_at,
    teamCount: counts?.teamCount ?? 0,
    competitionCount: counts?.competitionCount ?? 0
  };
}

function normalizeCompetitionRecord(record: CompetitionRecord, teamCount = 0): CompetitionListItem {
  return {
    id: record.id,
    leagueId: record.league_id,
    name: record.name,
    slug: record.slug,
    seasonLabel: record.season_label,
    description: record.description,
    venueOverride: record.venue_override,
    type: record.type,
    coverageMode: record.coverage_mode,
    playoffSize: normalizePlayoffSize(record.playoff_size),
    isPublic: record.is_public,
    status: record.status,
    createdAt: record.created_at,
    teamCount
  };
}

function normalizeLeagueTeam(record: LeagueTeamRecord): LeagueTeamListItem {
  return {
    id: record.id,
    leagueId: record.league_id,
    name: record.name,
    shortName: record.short_name,
    slug: record.slug,
    logoUrl: record.logo_path ? getTeamLogoUrl(record.id) : null,
    notes: record.notes,
    createdAt: record.created_at
  };
}

function normalizeCompetitionTeam(record: CompetitionTeamRecord): CompetitionTeamListItem {
  return {
    id: record.id,
    competitionId: record.competition_id,
    leagueTeamId: record.league_team_id,
    displayName: record.display_name,
    shortName: record.short_name,
    logoUrl: record.logo_path ? getTeamLogoUrl(record.league_team_id) : null,
    displayOrder: Number(record.display_order),
    notes: record.notes,
    createdAt: record.created_at
  };
}

function normalizeCompetitionPlayer(record: CompetitionTeamPlayerRow): CompetitionPlayerListItem {
  return {
    id: record.id,
    competitionTeamId: record.competition_team_id,
    fullName: record.full_name,
    shirtNumber: record.shirt_number,
    position: record.position,
    active: record.active,
    createdAt: record.created_at,
    updatedAt: record.updated_at
  };
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

async function loadLeagueCounts(params: {
  leagueIds: string[];
  publicCompetitionsOnly?: boolean;
}) {
  const { leagueIds, publicCompetitionsOnly = false } = params;
  const teamCounts = new Map<string, number>();
  const competitionCounts = new Map<string, number>();
  if (!leagueIds.length) {
    return {
      teamCounts,
      competitionCounts
    };
  }

  const supabase = await createSupabaseServerClient();
  const competitionQuery = supabase.from("competitions").select("league_id, is_public, status").in("league_id", leagueIds);
  const [{ data: leagueTeams, error: leagueTeamsError }, { data: competitions, error: competitionsError }] =
    await Promise.all([
      supabase.from("league_teams").select("league_id").in("league_id", leagueIds),
      competitionQuery
    ]);

  if (leagueTeamsError) throw new Error(leagueTeamsError.message);
  if (competitionsError) throw new Error(competitionsError.message);

  for (const row of leagueTeams ?? []) {
    const leagueId = String(row.league_id);
    teamCounts.set(leagueId, (teamCounts.get(leagueId) ?? 0) + 1);
  }

  for (const row of competitions ?? []) {
    if (
      publicCompetitionsOnly &&
      (!row.is_public || !isPublicTournamentStatus(String(row.status ?? "")))
    ) {
      continue;
    }

    const leagueId = String(row.league_id);
    competitionCounts.set(leagueId, (competitionCounts.get(leagueId) ?? 0) + 1);
  }

  return {
    teamCounts,
    competitionCounts
  };
}

async function loadCompetitionTeamCounts(competitionIds: string[]) {
  const counts = new Map<string, number>();
  if (!competitionIds.length) return counts;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("competition_teams")
    .select("competition_id")
    .in("competition_id", competitionIds);

  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const competitionId = String(row.competition_id);
    counts.set(competitionId, (counts.get(competitionId) ?? 0) + 1);
  }

  return counts;
}

async function loadLeagueById(leagueId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("leagues")
    .select("id, name, slug, description, logo_path, photo_path, venue_name, location_notes, is_public, status, created_at")
    .eq("id", leagueId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data ?? null) as LeagueRecord | null;
}

async function loadLeagueBySlug(leagueSlug: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("leagues")
    .select("id, name, slug, description, logo_path, photo_path, venue_name, location_notes, is_public, status, created_at")
    .eq("slug", leagueSlug)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data ?? null) as LeagueRecord | null;
}

async function loadCompetitionById(params: {
  competitionId: string;
  leagueId?: string;
}) {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("competitions")
    .select(
      "id, league_id, name, slug, season_label, description, venue_override, type, coverage_mode, playoff_size, is_public, status, created_at"
    )
    .eq("id", params.competitionId);

  if (params.leagueId) {
    query = query.eq("league_id", params.leagueId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as CompetitionRecord | null;
}

async function loadCompetitionBySlugs(params: {
  leagueId: string;
  competitionSlug: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("competitions")
    .select(
      "id, league_id, name, slug, season_label, description, venue_override, type, coverage_mode, playoff_size, is_public, status, created_at"
    )
    .eq("league_id", params.leagueId)
    .eq("slug", params.competitionSlug)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data ?? null) as CompetitionRecord | null;
}

async function loadLeagueTeams(leagueId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("league_teams")
    .select("id, league_id, name, short_name, slug, logo_path, notes, created_at")
    .eq("league_id", leagueId)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as LeagueTeamRecord[]).map(normalizeLeagueTeam);
}

async function loadLeagueAdminData(leagueId: string) {
  const supabase = await createSupabaseServerClient();
  const [{ data: adminRows, error: adminRowsError }, { data: inviteRows, error: inviteRowsError }] =
    await Promise.all([
      supabase
        .from("league_admins")
        .select("id, league_id, admin_id, role, created_at")
        .eq("league_id", leagueId)
        .order("created_at", { ascending: true }),
      supabase
        .from("league_admin_invites")
        .select("id, league_id, email, invite_token, expires_at, created_at, status")
        .eq("league_id", leagueId)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
    ]);

  if (adminRowsError) throw new Error(adminRowsError.message);
  if (inviteRowsError) throw new Error(inviteRowsError.message);

  const uniqueAdminIds = Array.from(new Set((adminRows ?? []).map((row) => String(row.admin_id))));
  const [{ data: profiles, error: profilesError }, emailsById] = await Promise.all([
    uniqueAdminIds.length
      ? supabase.from("admins").select("id, display_name").in("id", uniqueAdminIds)
      : Promise.resolve({ data: [], error: null }),
    resolveAdminEmailsById(uniqueAdminIds)
  ]);

  if (profilesError) throw new Error(profilesError.message);

  const profilesById = new Map(((profiles ?? []) as AdminProfileRow[]).map((profile) => [profile.id, profile]));

  return {
    admins: ((adminRows ?? []) as LeagueAdminRow[]).map<LeagueAdminListItem>((row) => ({
      id: row.admin_id,
      membershipId: row.id,
      displayName: profilesById.get(row.admin_id)?.display_name ?? "Admin",
      email: emailsById.get(row.admin_id) ?? null,
      role: row.role,
      createdAt: row.created_at
    })),
    pendingInvites: ((inviteRows ?? []) as LeagueAdminInviteRow[]).map<LeagueAdminInviteListItem>((row) => ({
      id: row.id,
      leagueId: row.league_id,
      email: row.email,
      inviteToken: row.invite_token,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      status: row.status
    }))
  };
}

async function loadCompetitionCoreBundle(params: {
  competition: CompetitionRecord;
  league: LeagueRecord;
}) {
  const { competition, league } = params;
  const supabase = await createSupabaseServerClient();
  const [
    { data: competitionTeams, error: competitionTeamsError },
    { data: rounds, error: roundsError },
    { data: matches, error: matchesError },
    { data: byes, error: byesError }
  ] = await Promise.all([
    supabase
      .from("competition_teams")
      .select("id, competition_id, league_team_id, display_name, short_name, logo_path, display_order, notes, created_at")
      .eq("competition_id", competition.id)
      .order("display_order", { ascending: true }),
    supabase
      .from("competition_rounds")
      .select("id, competition_id, round_number, name, phase, stage_label, starts_at, ends_at")
      .eq("competition_id", competition.id)
      .order("round_number", { ascending: true }),
    supabase
      .from("competition_matches")
      .select(
        "id, competition_id, round_id, home_team_id, away_team_id, phase, stage_label, scheduled_at, venue, status, created_by, created_at, updated_at"
      )
      .eq("competition_id", competition.id),
    supabase
      .from("competition_byes")
      .select("id, competition_id, round_id, competition_team_id, phase, kind, note, created_at")
      .eq("competition_id", competition.id)
  ]);

  if (competitionTeamsError) throw new Error(competitionTeamsError.message);
  if (roundsError) throw new Error(roundsError.message);
  if (matchesError) throw new Error(matchesError.message);
  if (byesError) throw new Error(byesError.message);

  const normalizedCompetitionTeams = ((competitionTeams ?? []) as CompetitionTeamRecord[]).map(normalizeCompetitionTeam);
  const matchIds = ((matches ?? []) as CompetitionMatchRecord[]).map((match) => match.id);

  const [{ data: results, error: resultsError }, { data: playerStats, error: playerStatsError }] =
    await Promise.all([
      matchIds.length
        ? supabase
            .from("competition_match_results")
            .select(
              "match_id, home_score, away_score, penalty_home_score, penalty_away_score, winner_team_id, mvp_player_id, mvp_player_name, notes, updated_at"
            )
            .in("match_id", matchIds)
        : Promise.resolve({ data: [], error: null }),
      matchIds.length
        ? supabase
            .from("competition_match_player_stats")
            .select("match_id, team_id, player_id, player_name, goals, yellow_cards, red_cards, is_mvp, updated_at")
            .in("match_id", matchIds)
        : Promise.resolve({ data: [], error: null })
    ]);

  if (resultsError) throw new Error(resultsError.message);
  if (playerStatsError) throw new Error(playerStatsError.message);

  const teamReferences: TournamentTeamReference[] = normalizedCompetitionTeams.map((team) => ({
    id: team.id,
    name: team.displayName,
    short_name: team.shortName,
    display_order: team.displayOrder,
    notes: team.notes
  }));
  const roundReferences = (rounds ?? []) as CompetitionRoundRecord[];
  const byeReferences = (byes ?? []) as CompetitionByeRecord[];
  const matchReferences = (matches ?? []) as CompetitionMatchRecord[];
  const resultReferences = (results ?? []) as CompetitionMatchResultRecord[];
  const playerStatReferences = (playerStats ?? []) as CompetitionMatchPlayerStatRecord[];

  return {
    league: normalizeLeagueRecord(league),
    competition: normalizeCompetitionRecord(competition, normalizedCompetitionTeams.length),
    competitionTeams: normalizedCompetitionTeams,
    rounds: roundReferences,
    byes: byeReferences,
    matches: matchReferences,
    results: resultReferences,
    playerStats: playerStatReferences,
    standings: buildTournamentStandings({
      teams: teamReferences,
      matches: matchReferences,
      results: resultReferences
    }),
    fixture: buildTournamentFixture({
      teams: teamReferences,
      rounds: roundReferences,
      matches: matchReferences,
      byes: byeReferences,
      results: resultReferences
    }),
    topScorers: buildTournamentTopScorers({
      teams: teamReferences,
      playerStats: playerStatReferences
    }),
    topFigures: buildTournamentTopFigures({
      teams: teamReferences,
      playerStats: playerStatReferences
    }),
    bestDefense: buildTournamentBestDefense({
      teams: teamReferences,
      matches: matchReferences,
      results: resultReferences
    })
  } satisfies CompetitionBundleCore;
}

async function loadCompetitionPlayers(competitionId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: competitionTeams, error: competitionTeamsError } = await supabase
    .from("competition_teams")
    .select("id")
    .eq("competition_id", competitionId);

  if (competitionTeamsError) throw new Error(competitionTeamsError.message);

  const competitionTeamIds = (competitionTeams ?? []).map((row) => String(row.id));
  if (!competitionTeamIds.length) {
    return {
      players: [] as CompetitionPlayerListItem[],
      playersByTeam: new Map<string, CompetitionPlayerListItem[]>()
    };
  }

  const { data: players, error: playersError } = await supabase
    .from("competition_team_players")
    .select("id, competition_team_id, full_name, shirt_number, position, active, created_at, updated_at")
    .in("competition_team_id", competitionTeamIds)
    .order("full_name", { ascending: true });

  if (playersError) throw new Error(playersError.message);

  const normalizedPlayers = ((players ?? []) as CompetitionTeamPlayerRow[]).map(normalizeCompetitionPlayer);
  const playersByTeam = new Map<string, CompetitionPlayerListItem[]>();

  for (const player of normalizedPlayers) {
    const current = playersByTeam.get(player.competitionTeamId) ?? [];
    current.push(player);
    playersByTeam.set(player.competitionTeamId, current);
  }

  return {
    players: normalizedPlayers,
    playersByTeam
  };
}

async function loadCompetitionAdminBundle(params: {
  competition: CompetitionRecord;
  league: LeagueRecord;
}) {
  const core = await loadCompetitionCoreBundle(params);
  const supabase = await createSupabaseServerClient();
  const [playersData, leagueTeams, captainData] = await Promise.all([
    loadCompetitionPlayers(params.competition.id),
    loadLeagueTeams(params.league.id),
    (async () => {
      const normalizedCompetitionTeams = core.competitionTeams;
      const captainRowsResult = await supabase
        .from("competition_team_captains")
        .select("id, competition_id, competition_team_id, captain_id, created_at")
        .eq("competition_id", params.competition.id);
      const captainInvitesResult = await supabase
        .from("competition_captain_invites")
        .select("id, competition_id, competition_team_id, email, invite_token, expires_at, created_at")
        .eq("competition_id", params.competition.id)
        .order("created_at", { ascending: false });

      if (captainRowsResult.error) throw new Error(captainRowsResult.error.message);
      if (captainInvitesResult.error) throw new Error(captainInvitesResult.error.message);

      const captainRows = (captainRowsResult.data ?? []) as CompetitionTeamCaptainRow[];
      const captainIds = Array.from(new Set(captainRows.map((row) => row.captain_id)));
      const { data: captainProfiles, error: captainProfilesError } = captainIds.length
        ? await supabase.from("admins").select("id, display_name").in("id", captainIds)
        : { data: [], error: null };

      if (captainProfilesError) throw new Error(captainProfilesError.message);

      const captainProfilesById = new Map(
        ((captainProfiles ?? []) as AdminProfileRow[]).map((profile) => [profile.id, profile])
      );
      const teamCaptainsByTeam = new Map(
        captainRows.map((row) => [
          row.competition_team_id,
          {
            id: row.id,
            competitionId: row.competition_id,
            competitionTeamId: row.competition_team_id,
            captainId: row.captain_id,
            displayName: captainProfilesById.get(row.captain_id)?.display_name ?? "Capitan",
            createdAt: row.created_at
          }
        ])
      );
      const captainInvitesByTeam = new Map(
        ((captainInvitesResult.data ?? []) as CompetitionCaptainInviteRow[]).map((row) => [
          row.competition_team_id,
          {
            id: row.id,
            competitionId: row.competition_id,
            competitionTeamId: row.competition_team_id,
            email: row.email,
            inviteToken: row.invite_token,
            expiresAt: row.expires_at,
            createdAt: row.created_at
          }
        ])
      );

      return {
        normalizedCompetitionTeams,
        teamCaptainsByTeam,
        captainInvitesByTeam
      };
    })()
  ]);

  return {
    ...core,
    leagueTeams,
    players: playersData.players,
    playersByTeam: playersData.playersByTeam,
    teamCaptainsByTeam: captainData.teamCaptainsByTeam,
    captainInvitesByTeam: captainData.captainInvitesByTeam
  };
}

async function loadCompetitionCaptainBundle(params: {
  competition: CompetitionRecord;
  league: LeagueRecord;
}) {
  const core = await loadCompetitionCoreBundle(params);
  const playersData = await loadCompetitionPlayers(params.competition.id);

  return {
    ...core,
    players: playersData.players,
    playersByTeam: playersData.playersByTeam
  } satisfies CompetitionBundleWithPlayers;
}

export async function getPublicLeagues(): Promise<LeagueListItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("leagues")
    .select("id, name, slug, description, logo_path, venue_name, location_notes, is_public, status, created_at")
    .eq("is_public", true)
    .in("status", ["active", "finished"])
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const leagues = (data ?? []) as LeagueRecord[];
  const leagueIds = leagues.map((league) => league.id);
  const { teamCounts, competitionCounts } = await loadLeagueCounts({
    leagueIds,
    publicCompetitionsOnly: true
  });

  return leagues.map((league) =>
    normalizeLeagueRecord(league, {
      teamCount: teamCounts.get(league.id) ?? 0,
      competitionCount: competitionCounts.get(league.id) ?? 0
    })
  );
}

export async function getPublicLeagueBySlug(leagueSlug: string) {
  noStore();

  const league = await loadLeagueBySlug(leagueSlug);
  if (!league || !league.is_public || !isPublicTournamentStatus(league.status)) return null;

  const supabase = await createSupabaseServerClient();
  const [{ data: competitions, error: competitionsError }, leagueTeams] = await Promise.all([
    supabase
      .from("competitions")
      .select(
        "id, league_id, name, slug, season_label, description, venue_override, type, coverage_mode, playoff_size, is_public, status, created_at"
      )
      .eq("league_id", league.id)
      .eq("is_public", true)
      .in("status", ["active", "finished"])
      .order("created_at", { ascending: false }),
    loadLeagueTeams(league.id)
  ]);

  if (competitionsError) throw new Error(competitionsError.message);

  const competitionRows = (competitions ?? []) as CompetitionRecord[];
  const competitionCounts = await loadCompetitionTeamCounts(competitionRows.map((row) => row.id));

  return {
    league: normalizeLeagueRecord(league, {
      teamCount: leagueTeams.length,
      competitionCount: competitionRows.length
    }),
    leagueTeams,
    competitions: competitionRows.map((competition) =>
      normalizeCompetitionRecord(competition, competitionCounts.get(competition.id) ?? 0)
    )
  };
}

export async function getPublicCompetitionBySlugs(params: {
  leagueSlug: string;
  competitionSlug: string;
}) {
  noStore();

  const league = await loadLeagueBySlug(params.leagueSlug);
  if (!league || !league.is_public || !isPublicTournamentStatus(league.status)) return null;

  const competition = await loadCompetitionBySlugs({
    leagueId: league.id,
    competitionSlug: params.competitionSlug
  });

  if (!competition || !competition.is_public || !isPublicTournamentStatus(competition.status)) return null;

  return loadCompetitionCoreBundle({ competition, league });
}

export async function getPublicCompetitionMatchDetails(params: {
  leagueSlug: string;
  competitionSlug: string;
  matchId: string;
}) {
  const competitionData = await getPublicCompetitionBySlugs(params);
  if (!competitionData) return null;

  const match = competitionData.fixture.find(
    (row) => row.kind === "match" && row.id === params.matchId
  ) ?? null;
  if (!match || !match.homeTeamId || !match.awayTeamId) return null;

  const result = competitionData.results.find((row) => row.match_id === params.matchId) ?? null;
  const teamById = new Map(
    competitionData.competitionTeams.map((team) => [
      team.id,
      {
        name: team.displayName,
        shortName: team.shortName
      }
    ])
  );
  const stats = competitionData.playerStats
    .filter((row) => row.match_id === params.matchId)
    .map((row) => ({
      ...row,
      teamName: teamById.get(row.team_id)?.name ?? "Equipo",
      teamShortName: teamById.get(row.team_id)?.shortName ?? null
    }));

  return {
    league: competitionData.league,
    competition: competitionData.competition,
    match,
    result,
    homeStats: stats.filter((row) => row.team_id === match.homeTeamId),
    awayStats: stats.filter((row) => row.team_id === match.awayTeamId)
  };
}

export async function getAdminLeagueList() {
  const admin = await requireAdminSession();
  const leagues = await getAdminLeagues(admin);
  const { teamCounts, competitionCounts } = await loadLeagueCounts({
    leagueIds: leagues.map((league) => league.id)
  });

  return leagues.map((league) =>
    normalizeLeagueRecord(
      {
        ...league,
        description: null,
        photo_path: null
      },
      {
        teamCount: teamCounts.get(league.id) ?? 0,
        competitionCount: competitionCounts.get(league.id) ?? 0
      }
    )
  );
}

export async function getAdminLeagueDetails(leagueId: string) {
  noStore();

  const league = await loadLeagueById(leagueId);
  if (!league) return null;

  const supabase = await createSupabaseServerClient();
  const [{ data: competitions, error: competitionsError }, leagueTeams, leagueAdminData] = await Promise.all([
    supabase
      .from("competitions")
      .select(
        "id, league_id, name, slug, season_label, description, venue_override, type, coverage_mode, playoff_size, is_public, status, created_at"
      )
      .eq("league_id", leagueId)
      .order("created_at", { ascending: false }),
    loadLeagueTeams(leagueId),
    loadLeagueAdminData(leagueId)
  ]);

  if (competitionsError) throw new Error(competitionsError.message);

  const competitionRows = (competitions ?? []) as CompetitionRecord[];
  const teamCounts = await loadCompetitionTeamCounts(competitionRows.map((row) => row.id));

  return {
    league: normalizeLeagueRecord(league, {
      teamCount: leagueTeams.length,
      competitionCount: competitionRows.length
    }),
    leagueTeams,
    competitions: competitionRows.map((competition) =>
      normalizeCompetitionRecord(competition, teamCounts.get(competition.id) ?? 0)
    ),
    leagueAdmins: leagueAdminData
  };
}

export async function getAdminCompetitionDetails(params: {
  leagueId: string;
  competitionId: string;
}) {
  noStore();

  const [league, competition] = await Promise.all([
    loadLeagueById(params.leagueId),
    loadCompetitionById({
      competitionId: params.competitionId,
      leagueId: params.leagueId
    })
  ]);

  if (!league || !competition) return null;
  return loadCompetitionAdminBundle({ competition, league });
}

export async function getCaptainCompetitionTeamPanelData(params: {
  competitionId: string;
  competitionTeamId: string;
}) {
  noStore();

  const competition = await loadCompetitionById({
    competitionId: params.competitionId
  });
  if (!competition) return null;

  const league = await loadLeagueById(competition.league_id);
  if (!league) return null;

  const bundle = await loadCompetitionCaptainBundle({ competition, league });
  const team = bundle.competitionTeams.find((row) => row.id === params.competitionTeamId) ?? null;
  if (!team) return null;

  const roster = (bundle.playersByTeam.get(team.id) ?? []).sort((left, right) =>
    left.fullName.localeCompare(right.fullName, "es")
  );
  const teamMatches = bundle.fixture.filter(
    (match) =>
      match.kind === "match" &&
      (match.homeTeamId === team.id || match.awayTeamId === team.id)
  );

  return {
    league: bundle.league,
    competition: bundle.competition,
    team,
    roster,
    standings: bundle.standings,
    standingRow: bundle.standings.find((row) => row.teamId === team.id) ?? null,
    teamMatches
  };
}

export async function getAdminCompetitionMatchSheetData(params: {
  leagueId: string;
  competitionId: string;
  matchId: string;
}) {
  const details = await getAdminCompetitionDetails({
    leagueId: params.leagueId,
    competitionId: params.competitionId
  });
  if (!details) return null;

  const match = details.fixture.find(
    (row) => row.kind === "match" && row.id === params.matchId
  ) ?? null;
  if (!match || !match.homeTeamId || !match.awayTeamId) return null;

  const teamPlayers = details.players.filter(
    (player) =>
      player.competitionTeamId === match.homeTeamId || player.competitionTeamId === match.awayTeamId
  );
  const result = details.results.find((row) => row.match_id === params.matchId) ?? null;
  const stats = details.playerStats.filter((row) => row.match_id === params.matchId);
  const statsByKey = new Map(
    stats.map((row) => [`${row.team_id}:${row.player_id ?? row.player_name.toLowerCase()}`, row])
  );

  return {
    league: details.league,
    competition: details.competition,
    match,
    result,
    registeredPlayers: teamPlayers.map((player) => {
      const key = `${player.competitionTeamId}:${player.id}`;
      const stat = statsByKey.get(key) ?? null;
      return {
        id: player.id,
        teamId: player.competitionTeamId,
        fullName: player.fullName,
        shirtNumber: player.shirtNumber,
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

export async function getAdminLeagueBillingData() {
  noStore();

  const admin = await requireAdminSession();
  const supabase = await createSupabaseServerClient();
  const adminLeagues = await getAdminLeagues(admin);
  const leagueIds = adminLeagues.map((league) => league.id);
  const query = admin.isSuperAdmin
    ? supabase
        .from("league_billing_payments")
        .select("id, admin_id, requested_league_name, requested_league_slug, created_league_id, amount, currency_id, status, purpose, mp_external_reference, mp_payment_id, mp_preference_id, checkout_url, checkout_sandbox_url, approved_at, period_start, period_end, subscription_applied_at, created_at, updated_at")
        .order("created_at", { ascending: false })
    : supabase
        .from("league_billing_payments")
        .select("id, admin_id, requested_league_name, requested_league_slug, created_league_id, amount, currency_id, status, purpose, mp_external_reference, mp_payment_id, mp_preference_id, checkout_url, checkout_sandbox_url, approved_at, period_start, period_end, subscription_applied_at, created_at, updated_at")
        .eq("admin_id", admin.userId)
        .order("created_at", { ascending: false });

  const { data: payments, error } = await query;
  if (error) throw new Error(error.message);

  const createdLeagueIds = Array.from(
    new Set((payments ?? []).map((row) => String(row.created_league_id ?? "")).filter(Boolean))
  );
  const { data: createdLeagues, error: leaguesError } = createdLeagueIds.length
    ? await supabase
        .from("leagues")
        .select("id, name, slug, status")
        .in("id", createdLeagueIds)
    : { data: [], error: null };

  if (leaguesError) throw new Error(leaguesError.message);

  const leagueById = new Map((createdLeagues ?? []).map((league) => [String(league.id), league]));

  let subscriptionRows: LeagueBillingSubscriptionRow[] = [];
  if (leagueIds.length) {
    const { data, error: subscriptionsError } = await supabase
      .from("league_billing_subscriptions")
      .select("league_id, status, current_period_start, current_period_end, last_payment_at")
      .in("league_id", leagueIds);

    if (subscriptionsError && !isLeagueBillingSchemaMissing(subscriptionsError.message)) {
      throw new Error(subscriptionsError.message);
    }

    if (!subscriptionsError) {
      subscriptionRows = (data ?? []) as LeagueBillingSubscriptionRow[];
    }
  }

  const subscriptionByLeagueId = new Map(
    subscriptionRows.map((row) => [String(row.league_id), row])
  );

  return {
    leagues: adminLeagues.map((league) => {
      const subscription = subscriptionByLeagueId.get(league.id) ?? null;
      const writeWindow = resolveLeagueWriteWindow({
        subscription: subscription
          ? {
              status: subscription.status,
              current_period_end: subscription.current_period_end
            }
          : null
      });
      const accessLabel = writeWindow.subscriptionActive
        ? "Edicion habilitada"
        : writeWindow.accessValidUntil
          ? "Solo lectura"
          : "Pendiente de activacion";

      return {
        league: normalizeLeagueRecord(
          {
            ...league,
            description: null,
            photo_path: null
          },
          {
            teamCount: 0,
            competitionCount: 0
          }
        ),
        access: {
          canWrite: writeWindow.canWrite,
          accessLabel,
          accessValidUntil: writeWindow.accessValidUntil,
          accessStartsAt: subscription?.current_period_start ?? null,
          writeLockedAt: writeWindow.writeLockedAt,
          subscriptionStatus: subscription?.status ?? null,
          subscriptionCurrentPeriodEnd: subscription?.current_period_end ?? null,
          subscriptionActive: writeWindow.subscriptionActive,
          lastPaymentAt: subscription?.last_payment_at ?? null
        }
      };
    }),
    payments: (payments ?? []).map((payment) => ({
      ...payment,
      createdLeague:
        payment.created_league_id && leagueById.has(String(payment.created_league_id))
          ? leagueById.get(String(payment.created_league_id))
          : null
    }))
  };
}

export function groupFixtureByRound(fixture: TournamentFixtureRow[]) {
  const rounds = new Map<
    string,
    {
      roundNumber: number;
      roundName: string;
      phase: TournamentFixtureRow["phase"];
      stageLabel: string;
      matches: TournamentFixtureRow[];
    }
  >();

  for (const match of fixture) {
    const key = `${match.phase}:${match.roundNumber}:${match.roundName}`;
    const current = rounds.get(key) ?? {
      roundNumber: match.roundNumber,
      roundName: match.roundName,
      phase: match.phase,
      stageLabel: match.stageLabel,
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

export const getPublicTournaments = getPublicLeagues;

export async function getPublicTournamentBySlug(slug: string) {
  const supabase = await createSupabaseServerClient();
  const { data: competition, error: competitionError } = await supabase
    .from("competitions")
    .select(
      "id, league_id, name, slug, season_label, description, venue_override, type, coverage_mode, playoff_size, is_public, status, created_at"
    )
    .eq("slug", slug)
    .maybeSingle();

  if (competitionError) throw new Error(competitionError.message);
  if (!competition || !competition.is_public || !isPublicTournamentStatus(String(competition.status))) return null;

  const league = await loadLeagueById(String(competition.league_id));
  if (!league || !league.is_public || !isPublicTournamentStatus(league.status)) return null;

  return loadCompetitionCoreBundle({
    competition: competition as CompetitionRecord,
    league
  });
}

export async function getPublicTournamentMatchDetails(params: {
  slug: string;
  matchId: string;
}) {
  const competitionData = await getPublicTournamentBySlug(params.slug);
  if (!competitionData) return null;

  const match = competitionData.fixture.find(
    (row) => row.kind === "match" && row.id === params.matchId
  ) ?? null;
  if (!match || !match.homeTeamId || !match.awayTeamId) return null;

  const result = competitionData.results.find((row) => row.match_id === params.matchId) ?? null;
  const teamById = new Map(
    competitionData.competitionTeams.map((team) => [
      team.id,
      {
        name: team.displayName,
        shortName: team.shortName
      }
    ])
  );
  const stats = competitionData.playerStats
    .filter((row) => row.match_id === params.matchId)
    .map((row) => ({
      ...row,
      teamName: teamById.get(row.team_id)?.name ?? "Equipo",
      teamShortName: teamById.get(row.team_id)?.shortName ?? null
    }));

  return {
    tournament: competitionData.competition,
    match,
    result,
    homeStats: stats.filter((row) => row.team_id === match.homeTeamId),
    awayStats: stats.filter((row) => row.team_id === match.awayTeamId)
  };
}

export async function getAdminTournamentDetails(tournamentId: string) {
  const competition = await loadCompetitionById({ competitionId: tournamentId });
  if (!competition) return null;

  const league = await loadLeagueById(competition.league_id);
  if (!league) return null;

  const details = await loadCompetitionAdminBundle({ competition, league });
  return {
    ...details,
    tournament: details.competition,
    tournamentAdmins: {
      admins: [] as LeagueAdminListItem[],
      pendingInvites: [] as LeagueAdminInviteListItem[]
    },
    schemaSupport: {
      tournamentAdminInvites: true,
      tournamentTeamCaptains: true,
      tournamentCaptainInvites: true
    },
    teamCaptainsByTeam: new Map(
      [...details.teamCaptainsByTeam.entries()].map(([teamId, value]) => [
        teamId,
        {
          ...value,
          teamId
        }
      ])
    ),
    captainInvitesByTeam: new Map(
      [...details.captainInvitesByTeam.entries()].map(([teamId, value]) => [
        teamId,
        {
          ...value,
          teamId
        }
      ])
    )
  };
}

export async function getCaptainTournamentTeamPanelData(params: {
  tournamentId: string;
  teamId: string;
}) {
  const data = await getCaptainCompetitionTeamPanelData({
    competitionId: params.tournamentId,
    competitionTeamId: params.teamId
  });

  if (!data) return null;

  return {
    ...data,
    tournament: data.competition,
    team: {
      id: data.team.id,
      name: data.team.displayName,
      shortName: data.team.shortName
    }
  };
}

export const getAdminTournamentMatchSheetData = getAdminCompetitionMatchSheetData;
