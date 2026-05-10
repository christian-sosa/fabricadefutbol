import { unstable_noStore as noStore } from "next/cache";

import { requireAdminSession } from "@/lib/auth/admin";
import { getAdminClubs } from "@/lib/auth/clubs";
import {
  buildClubFinancialSummary,
  buildClubPublicSnapshot,
  type ClubCompetitionRecord,
  type ClubFinancialSummary,
  type ClubPublicActivity,
  type ClubLineupRecord,
  type ClubMatchPaymentRecord,
  type ClubMatchPlayerStatRecord,
  type ClubMatchRecord,
  type ClubPublicPlayerStat,
  type ClubPlayerRecord,
  type ClubPublicMatch,
  type ClubPublicRecords,
  type ClubPublicSnapshotCore,
  type ClubPublicSnapshot,
  type ClubPublicStatRow,
  type ClubPublicSummary,
  type ClubPublicTeam,
  type ClubRecord,
  type ClubTeamPlayerRecord,
  type ClubTeamRecord
} from "@/lib/domain/clubs";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ClubAdminListItem = {
  id: string;
  membershipId: string;
  displayName: string;
  email: string | null;
  createdAt: string;
};

export type ClubAdminInviteListItem = {
  id: string;
  clubId: string;
  email: string;
  inviteToken: string;
  expiresAt: string;
  createdAt: string;
  status: "pending" | "accepted" | "revoked";
};

export type AdminClubDetails = {
  club: ClubRecord;
  players: ClubPlayerRecord[];
  teams: ClubTeamRecord[];
  teamPlayers: ClubTeamPlayerRecord[];
  matches: ClubMatchRecord[];
  lineups: ClubLineupRecord[];
  stats: ClubMatchPlayerStatRecord[];
  payments: ClubMatchPaymentRecord[];
  financialSummary: ClubFinancialSummary;
  publicSnapshot: ClubPublicSnapshot;
  admins: ClubAdminListItem[];
  pendingInvites: ClubAdminInviteListItem[];
  competitions: ClubCompetitionRecord[];
};

type ClubAdminRow = {
  id: string;
  club_id: string;
  admin_id: string;
  created_at: string;
  admins?: { id: string; display_name: string } | Array<{ id: string; display_name: string }> | null;
};

type ClubAdminInviteRow = {
  id: string;
  club_id: string;
  email: string;
  invite_token: string;
  expires_at: string;
  created_at: string;
  status: "pending" | "accepted" | "revoked";
};

type ClubSnapshotRow = {
  summary: ClubPublicSummary | null;
  activity: ClubPublicActivity[] | null;
  teams: ClubPublicTeam[] | null;
  recent_matches: ClubPublicMatch[] | null;
  player_stats: ClubPublicPlayerStat[] | null;
  records: ClubPublicRecords | null;
  top_scorers: ClubPublicStatRow[] | null;
  top_assisters: ClubPublicStatRow[] | null;
  top_figures: ClubPublicStatRow[] | null;
  competition_stats: ClubPublicSnapshot["competitionStats"] | null;
  available_modalities: ClubPublicSnapshot["availableModalities"] | null;
  by_modality: ClubPublicSnapshot["byModality"] | null;
};

function emptySnapshot(clubName: string): ClubPublicSnapshot {
  return {
    summary: {
      clubName,
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
    competitionStats: [],
    availableModalities: [],
    byModality: {}
  };
}

function normalizePlayerStat(row: ClubPublicPlayerStat): ClubPublicPlayerStat {
  return {
    ...row,
    attendances: row.attendances ?? row.matchesPlayed ?? 0,
    presentNotPlayed: row.presentNotPlayed ?? 0
  };
}

function normalizeSnapshotCore(
  row: Partial<ClubPublicSnapshotCore> | null | undefined,
  base: ClubPublicSnapshot
): ClubPublicSnapshotCore {
  const records = row?.records
    ? {
        ...base.records,
        ...row.records,
        topScorerAllTime: row.records.topScorerAllTime ? normalizePlayerStat(row.records.topScorerAllTime) : null,
        topAssistsAllTime: row.records.topAssistsAllTime ? normalizePlayerStat(row.records.topAssistsAllTime) : null,
        mostMvps: row.records.mostMvps ? normalizePlayerStat(row.records.mostMvps) : null,
        mostAttendances: row.records.mostAttendances ? normalizePlayerStat(row.records.mostAttendances) : null,
        mostMatchesPlayed: row.records.mostMatchesPlayed ? normalizePlayerStat(row.records.mostMatchesPlayed) : null
      }
    : base.records;

  return {
    summary: {
      ...base.summary,
      ...(row?.summary ?? {})
    },
    activity: row?.activity ?? [],
    teams: (row?.teams ?? []).map((team) => ({
      ...team,
      modality: team.modality ?? "11v11",
      logoPath: team.logoPath ?? null,
      players: team.players ?? [],
      matches: (team.matches ?? []).map((match) => ({
        ...match,
        modality: match.modality ?? team.modality ?? "11v11"
      }))
    })),
    recentMatches: (row?.recentMatches ?? []).map((match) => ({
      ...match,
      modality: match.modality ?? "11v11"
    })),
    playerStats: (row?.playerStats ?? []).map(normalizePlayerStat),
    records,
    topScorers: row?.topScorers ?? [],
    topAssisters: row?.topAssisters ?? [],
    topFigures: row?.topFigures ?? [],
    competitionStats: row?.competitionStats ?? []
  };
}

function normalizeSnapshot(row: ClubSnapshotRow | null, clubName: string): ClubPublicSnapshot {
  const base = emptySnapshot(clubName);
  if (!row) return base;

  const core = normalizeSnapshotCore(
    {
      summary: row.summary ?? undefined,
      activity: row.activity ?? undefined,
      teams: row.teams ?? undefined,
      recentMatches: row.recent_matches ?? undefined,
      playerStats: row.player_stats ?? undefined,
      records: row.records ?? undefined,
      topScorers: row.top_scorers ?? undefined,
      topAssisters: row.top_assisters ?? undefined,
      topFigures: row.top_figures ?? undefined,
      competitionStats: row.competition_stats ?? undefined
    },
    base
  );
  const byModality = Object.fromEntries(
    Object.entries(row.by_modality ?? {}).map(([modality, value]) => [
      modality,
      normalizeSnapshotCore(value, base)
    ])
  ) as ClubPublicSnapshot["byModality"];
  const availableModalities = row.available_modalities?.length
    ? row.available_modalities
    : Array.from(
        new Set([
          ...core.teams.map((team) => team.modality),
          ...core.recentMatches.map((match) => match.modality)
        ])
      );

  return {
    ...core,
    availableModalities,
    byModality
  };
}

async function resolveAdminEmailsById(adminIds: string[]) {
  const adminClient = createSupabaseAdminClient();
  const emailsById = new Map<string, string>();
  if (!adminClient || !adminIds.length) return emailsById;

  const resolved = await Promise.all(
    Array.from(new Set(adminIds)).map(async (adminId) => {
      try {
        const { data } = await adminClient.auth.admin.getUserById(adminId);
        return [adminId, data?.user?.email?.toLowerCase() ?? null] as const;
      } catch {
        return [adminId, null] as const;
      }
    })
  );

  for (const [adminId, email] of resolved) {
    if (email) emailsById.set(adminId, email);
  }

  return emailsById;
}

export async function getAdminClubList() {
  const admin = await requireAdminSession();
  return getAdminClubs(admin);
}

async function loadClubPrivateData(clubId: string) {
  const supabase = await createSupabaseServerClient();
  const [
    { data: club, error: clubError },
    { data: players, error: playersError },
    { data: competitions, error: competitionsError },
    { data: teams, error: teamsError },
    { data: teamPlayers, error: teamPlayersError },
    { data: matches, error: matchesError },
    { data: lineups, error: lineupsError },
    { data: stats, error: statsError },
    { data: payments, error: paymentsError }
  ] = await Promise.all([
    supabase
      .from("clubs")
      .select("id, name, slug, description, home_venue, logo_path, is_public, status, created_at")
      .eq("id", clubId)
      .maybeSingle(),
    supabase
      .from("club_players")
      .select("id, club_id, full_name, nickname, position, shirt_number, photo_path, notes, active, created_at")
      .eq("club_id", clubId)
      .order("full_name", { ascending: true }),
    supabase
      .from("club_competitions")
      .select("id, club_id, name, slug, active, notes")
      .eq("club_id", clubId)
      .order("name", { ascending: true }),
    supabase
      .from("club_teams")
      .select("id, club_id, name, short_name, logo_path, modality, active, notes, created_at")
      .eq("club_id", clubId)
      .order("name", { ascending: true }),
    supabase.from("club_team_players").select("id, club_team_id, club_player_id"),
    supabase
      .from("club_matches")
      .select("id, club_id, club_team_id, club_competition_id, modality, played_at, opponent_name, venue, goals_for, goals_against, status, notes, field_cost_cents, field_cost_currency, created_at")
      .eq("club_id", clubId)
      .order("played_at", { ascending: false }),
    supabase.from("club_match_lineups").select("id, match_id, club_player_id, guest_name, display_name, role"),
    supabase.from("club_match_player_stats").select("id, match_id, lineup_id, goals, assists, is_mvp"),
    supabase
      .from("club_match_payments")
      .select("id, match_id, lineup_id, expected_cents, paid_cents, paid_at, notes, updated_by, created_at, updated_at")
  ]);

  if (clubError) throw new Error(clubError.message);
  if (playersError) throw new Error(playersError.message);
  if (competitionsError) throw new Error(competitionsError.message);
  if (teamsError) throw new Error(teamsError.message);
  if (teamPlayersError) throw new Error(teamPlayersError.message);
  if (matchesError) throw new Error(matchesError.message);
  if (lineupsError) throw new Error(lineupsError.message);
  if (statsError) throw new Error(statsError.message);
  if (paymentsError) throw new Error(paymentsError.message);
  if (!club) return null;

  const matchIds = new Set((matches ?? []).map((match) => String(match.id)));
  const filteredLineups = ((lineups ?? []) as ClubLineupRecord[]).filter((lineup) =>
    matchIds.has(lineup.match_id)
  );
  const lineupIds = new Set(filteredLineups.map((lineup) => lineup.id));
  const filteredPayments = ((payments ?? []) as ClubMatchPaymentRecord[]).filter((payment) =>
    matchIds.has(payment.match_id) && lineupIds.has(payment.lineup_id)
  );

  return {
    club: club as ClubRecord,
    players: (players ?? []) as ClubPlayerRecord[],
    competitions: (competitions ?? []) as ClubCompetitionRecord[],
    teams: (teams ?? []) as ClubTeamRecord[],
    teamPlayers: ((teamPlayers ?? []) as ClubTeamPlayerRecord[]).filter((teamPlayer) =>
      ((teams ?? []) as ClubTeamRecord[]).some((team) => team.id === teamPlayer.club_team_id)
    ),
    matches: (matches ?? []) as ClubMatchRecord[],
    lineups: filteredLineups,
    stats: ((stats ?? []) as ClubMatchPlayerStatRecord[]).filter((stat) => lineupIds.has(stat.lineup_id)),
    payments: filteredPayments
  };
}

export async function refreshClubPublicSnapshot(clubId: string) {
  const privateData = await loadClubPrivateData(clubId);
  if (!privateData) return null;

  const snapshot = buildClubPublicSnapshot(privateData);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("club_public_snapshots").upsert(
    {
      club_id: clubId,
      summary: snapshot.summary,
      activity: snapshot.activity,
      teams: snapshot.teams,
      recent_matches: snapshot.recentMatches,
      player_stats: snapshot.playerStats,
      records: snapshot.records,
      top_scorers: snapshot.topScorers,
      top_assisters: snapshot.topAssisters,
      top_figures: snapshot.topFigures,
      competition_stats: snapshot.competitionStats,
      available_modalities: snapshot.availableModalities,
      by_modality: snapshot.byModality,
      refreshed_at: new Date().toISOString()
    },
    { onConflict: "club_id" }
  );

  if (error) throw new Error(error.message);
  return snapshot;
}

export async function getAdminClubDetails(clubId: string): Promise<AdminClubDetails | null> {
  noStore();
  const privateData = await loadClubPrivateData(clubId);
  if (!privateData) return null;

  const supabase = await createSupabaseServerClient();
  const [
    { data: snapshotRow, error: snapshotError },
    { data: adminsData, error: adminsError },
    { data: invitesData, error: invitesError }
  ] = await Promise.all([
    supabase
      .from("club_public_snapshots")
      .select("summary, activity, teams, recent_matches, player_stats, records, top_scorers, top_assisters, top_figures, competition_stats, available_modalities, by_modality")
      .eq("club_id", clubId)
      .maybeSingle(),
    supabase
      .from("club_admins")
      .select("id, club_id, admin_id, created_at, admins!club_admins_admin_id_fkey(id, display_name)")
      .eq("club_id", clubId)
      .order("created_at", { ascending: true }),
    supabase
      .from("club_admin_invites")
      .select("id, club_id, email, invite_token, expires_at, created_at, status")
      .eq("club_id", clubId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
  ]);

  if (snapshotError) throw new Error(snapshotError.message);
  if (adminsError) throw new Error(adminsError.message);
  if (invitesError) throw new Error(invitesError.message);

  const adminRows = (adminsData ?? []) as ClubAdminRow[];
  const emailsById = await resolveAdminEmailsById(adminRows.map((row) => row.admin_id));
  const now = Date.now();

  return {
    ...privateData,
    financialSummary: buildClubFinancialSummary({
      lineups: privateData.lineups,
      matches: privateData.matches,
      payments: privateData.payments
    }),
    publicSnapshot: normalizeSnapshot((snapshotRow ?? null) as ClubSnapshotRow | null, privateData.club.name),
    admins: adminRows.map((row) => {
      const relation = row.admins;
      const adminRow = Array.isArray(relation) ? relation[0] ?? null : relation ?? null;
      return {
        id: row.admin_id,
        membershipId: row.id,
        displayName: adminRow?.display_name ?? "Admin",
        email: emailsById.get(row.admin_id) ?? null,
        createdAt: row.created_at
      };
    }),
    pendingInvites: ((invitesData ?? []) as ClubAdminInviteRow[])
      .filter((invite) => {
        const expiresAt = Date.parse(invite.expires_at);
        return !Number.isFinite(expiresAt) || expiresAt > now;
      })
      .map((invite) => ({
        id: invite.id,
        clubId: invite.club_id,
        email: invite.email,
        inviteToken: invite.invite_token,
        expiresAt: invite.expires_at,
        createdAt: invite.created_at,
        status: invite.status
      }))
  };
}

export async function getPublicClubBySlug(slug: string) {
  noStore();
  const supabase = await createSupabaseServerClient();
  const { data: club, error: clubError } = await supabase
    .from("clubs")
    .select("id, name, slug, description, home_venue, logo_path, is_public, status, created_at")
    .eq("slug", slug)
    .maybeSingle();

  if (clubError) throw new Error(clubError.message);
  if (!club) return null;

  const { data: snapshot, error: snapshotError } = await supabase
    .from("club_public_snapshots")
    .select("summary, activity, teams, recent_matches, player_stats, records, top_scorers, top_assisters, top_figures, competition_stats, available_modalities, by_modality")
    .eq("club_id", club.id)
    .maybeSingle();

  if (snapshotError) throw new Error(snapshotError.message);

  return {
    club: club as ClubRecord,
    snapshot: normalizeSnapshot((snapshot ?? null) as ClubSnapshotRow | null, String(club.name))
  };
}
