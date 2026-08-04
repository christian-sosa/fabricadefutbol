import { unstable_noStore as noStore } from "next/cache";

import { requireAdminSession } from "@/lib/auth/admin";
import { getAdminClubs } from "@/lib/auth/clubs";
import {
  buildClubCallupSummary,
  buildClubFinancialSummary,
  buildClubPublicSnapshot,
  type ClubCallupGuestRecord,
  type ClubCallupPlayerRecord,
  type ClubCallupRecord,
  type ClubCallupSummary,
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
import {
  buildClubSitePublicHref,
  filterVisibleClubProducts,
  normalizeClubSiteSettings,
  type ClubProductRecord,
  type ClubSiteSettings,
  type ClubSiteSettingsRow
} from "@/lib/domain/club-sites";
import { isMissingSupabaseConfigurationError } from "@/lib/env";
import { canAccessClubsProduct } from "@/lib/features";
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
  callups: ClubCallupRecord[];
  callupPlayers: ClubCallupPlayerRecord[];
  callupGuests: ClubCallupGuestRecord[];
  callupSummaries: Record<string, ClubCallupSummary>;
  matches: ClubMatchRecord[];
  lineups: ClubLineupRecord[];
  stats: ClubMatchPlayerStatRecord[];
  payments: ClubMatchPaymentRecord[];
  financialSummary: ClubFinancialSummary;
  publicSnapshot: ClubPublicSnapshot;
  siteSettings: ClubSiteSettings;
  products: ClubProductRecord[];
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

type ClubProductRow = ClubProductRecord;

export type PublicClubSiteListItem = {
  club: ClubRecord;
  settings: ClubSiteSettings;
  productCount: number;
  publicHref: string;
};

export type PublicClubSiteDetails = {
  club: ClubRecord;
  settings: ClubSiteSettings;
  products: ClubProductRecord[];
  snapshot: ClubPublicSnapshot;
};

function shouldUseClubSiteDemoFallback() {
  return process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_ENABLE_CLUB_SITE_DEMO === "true";
}

function isMissingClubSiteSchemaError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string };
  return candidate.code === "42P01" || /club_site_settings|club_products/i.test(candidate.message ?? "");
}

function buildLaQuintaDemoSite(): PublicClubSiteDetails {
  const now = "2026-05-17T00:00:00.000Z";
  const club: ClubRecord = {
    id: "la-quinta-demo",
    name: "La Quinta",
    slug: "la-quinta",
    description: "Futbol, amigos y comunidad. Un espacio para seguir al club, ver datos del equipo y consultar productos oficiales.",
    home_venue: "La Quinta",
    logo_path: "/poc/la-quinta-logo.jpeg",
    is_public: true,
    status: "active",
    created_at: now
  };
  const settings = normalizeClubSiteSettings(
    {
      club_id: club.id,
      enabled: true,
      published: true,
      hero_image_path: "/poc/la-quinta-hero.webp",
      primary_color: "#f7951d",
      secondary_color: "#111111",
      accent_color: "#25D366",
      font_family: "montserrat",
      whatsapp_url_or_phone: "5491112345678",
      instagram_url: "https://instagram.com/laquintafc",
      section_visibility: {
        activity: true,
        catalog: true,
        matches: true,
        playerStats: true,
        records: true,
        teamData: true,
        teams: true
      }
    },
    club
  );
  const products: ClubProductRecord[] = [
    {
      id: "demo-product-1",
      club_id: club.id,
      name: "Camiseta titular",
      slug: "camiseta-titular",
      description: "Modelo naranja y negro para jugar o alentar.",
      category: "Camisetas",
      image_path: null,
      price_label: "Consultar precio",
      status: "available",
      visible: true,
      sort_order: 1,
      contact_channel: "whatsapp",
      contact_url: null,
      contact_message: null,
      created_at: now,
      updated_at: now
    },
    {
      id: "demo-product-2",
      club_id: club.id,
      name: "Buzo entrenamiento",
      slug: "buzo-entrenamiento",
      description: "Abrigo liviano con identidad del equipo.",
      category: "Indumentaria",
      image_path: null,
      price_label: "Consultar precio",
      status: "preorder",
      visible: true,
      sort_order: 2,
      contact_channel: "whatsapp",
      contact_url: null,
      contact_message: null,
      created_at: now,
      updated_at: now
    },
    {
      id: "demo-product-3",
      club_id: club.id,
      name: "Short oficial",
      slug: "short-oficial",
      description: "Short negro con detalle naranja.",
      category: "Indumentaria",
      image_path: null,
      price_label: "Consultar precio",
      status: "available",
      visible: true,
      sort_order: 3,
      contact_channel: "instagram",
      contact_url: null,
      contact_message: null,
      created_at: now,
      updated_at: now
    },
    {
      id: "demo-product-4",
      club_id: club.id,
      name: "Pack stickers",
      slug: "pack-stickers",
      description: "Stickers del escudo y frases del club.",
      category: "Merch",
      image_path: null,
      price_label: "Consultar precio",
      status: "available",
      visible: true,
      sort_order: 4,
      contact_channel: "whatsapp",
      contact_url: null,
      contact_message: null,
      created_at: now,
      updated_at: now
    }
  ];
  const playerStats: ClubPublicPlayerStat[] = [
    {
      playerId: "demo-player-1",
      name: "Mateo Alvarez",
      teamNames: ["Primera"],
      attendances: 18,
      presentNotPlayed: 0,
      matchesPlayed: 18,
      goals: 22,
      assists: 7,
      mvps: 5,
      lastMatchDate: "2026-05-10T18:00:00.000Z"
    },
    {
      playerId: "demo-player-2",
      name: "Santi Rojas",
      teamNames: ["Primera"],
      attendances: 17,
      presentNotPlayed: 1,
      matchesPlayed: 16,
      goals: 9,
      assists: 14,
      mvps: 4,
      lastMatchDate: "2026-05-10T18:00:00.000Z"
    },
    {
      playerId: "demo-player-3",
      name: "Nico Ferreyra",
      teamNames: ["Senior"],
      attendances: 21,
      presentNotPlayed: 0,
      matchesPlayed: 21,
      goals: 5,
      assists: 3,
      mvps: 2,
      lastMatchDate: "2026-05-03T18:00:00.000Z"
    }
  ];
  const snapshot: ClubPublicSnapshot = {
    summary: {
      clubName: club.name,
      teamCount: 2,
      playerCount: 28,
      playedMatches: 24,
      goalsFor: 76,
      goalsAgainst: 51,
      totalMatches: 24,
      totalGoals: 127,
      avgGoalsPerMatch: 5.3,
      totalPlayersDistinct: 28,
      totalAttendances: 312,
      presentNotPlayedCount: 6,
      firstMatchDate: "2026-02-01T18:00:00.000Z",
      lastMatchDate: "2026-05-10T18:00:00.000Z"
    },
    activity: [
      {
        type: "match_played",
        title: "Triunfo 5-3 ante Los Pibes",
        description: "La Quinta cerro el partido con dos goles en los ultimos diez minutos.",
        createdAt: "2026-05-10T18:00:00.000Z",
        entityId: "demo-match-1"
      },
      {
        type: "team_created",
        title: "Senior ya tiene plantel cargado",
        description: "El admin completo la base inicial para seguir rendimiento por equipo.",
        createdAt: "2026-05-02T18:00:00.000Z",
        entityId: "demo-team-2"
      }
    ],
    teams: [
      {
        id: "demo-team-1",
        name: "Primera",
        shortName: "LQ",
        logoPath: null,
        modality: "5v5",
        players: [
          { id: "demo-player-1", name: "Mateo Alvarez", position: "delantero", shirtNumber: 9 },
          { id: "demo-player-2", name: "Santi Rojas", position: "volante", shirtNumber: 10 }
        ],
        matches: [],
        playerCount: 16,
        matchesPlayed: 16,
        wins: 10,
        draws: 2,
        losses: 4,
        goalsFor: 54,
        goalsAgainst: 33,
        lastMatchDate: "2026-05-10T18:00:00.000Z"
      },
      {
        id: "demo-team-2",
        name: "Senior",
        shortName: "LQS",
        logoPath: null,
        modality: "7v7",
        players: [
          { id: "demo-player-3", name: "Nico Ferreyra", position: "defensor", shirtNumber: 4 }
        ],
        matches: [],
        playerCount: 12,
        matchesPlayed: 8,
        wins: 4,
        draws: 1,
        losses: 3,
        goalsFor: 22,
        goalsAgainst: 18,
        lastMatchDate: "2026-05-03T18:00:00.000Z"
      }
    ],
    recentMatches: [
      {
        id: "demo-match-1",
        playedAt: "2026-05-10T18:00:00.000Z",
        modality: "5v5",
        teamId: "demo-team-1",
        teamName: "Primera",
        competitionId: null,
        competitionName: "Amistoso",
        opponentName: "Los Pibes",
        venue: "La Quinta",
        goalsFor: 5,
        goalsAgainst: 3
      },
      {
        id: "demo-match-2",
        playedAt: "2026-05-03T18:00:00.000Z",
        modality: "7v7",
        teamId: "demo-team-2",
        teamName: "Senior",
        competitionId: null,
        competitionName: "Amistoso",
        opponentName: "Barrio Norte",
        venue: "La Quinta",
        goalsFor: 2,
        goalsAgainst: 2
      }
    ],
    playerStats,
    records: {
      topScorerAllTime: playerStats[0],
      topAssistsAllTime: playerStats[1],
      mostMvps: playerStats[0],
      mostAttendances: playerStats[2],
      mostMatchesPlayed: playerStats[2],
      bestWinStreak: null
    },
    topScorers: [],
    topAssisters: [],
    topFigures: [],
    competitionStats: [],
    availableModalities: ["5v5", "7v7"],
    byModality: {}
  };

  return {
    club,
    products,
    settings,
    snapshot
  };
}

function getDemoPublicClubSiteBySlug(slug: string) {
  return slug === "la-quinta" ? buildLaQuintaDemoSite() : null;
}

function getDemoPublicClubSites(): PublicClubSiteListItem[] {
  const site = buildLaQuintaDemoSite();
  return [
    {
      club: site.club,
      settings: site.settings,
      productCount: site.products.length,
      publicHref: buildClubSitePublicHref(site.club, site.settings)
    }
  ];
}

function normalizeClubProducts(rows: ClubProductRow[] | null | undefined): ClubProductRecord[] {
  return (rows ?? []).map((row) => ({
    id: String(row.id),
    club_id: String(row.club_id),
    name: String(row.name ?? ""),
    slug: String(row.slug ?? ""),
    description: row.description ?? null,
    category: row.category ?? null,
    image_path: row.image_path ?? null,
    price_label: row.price_label ?? null,
    status: row.status ?? "available",
    visible: Boolean(row.visible),
    sort_order: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : 0,
    contact_channel: row.contact_channel ?? "whatsapp",
    contact_url: row.contact_url ?? null,
    contact_message: row.contact_message ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at
  }));
}

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

async function loadClubSiteSettings(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  club: ClubRecord
) {
  const { data, error } = await supabase
    .from("club_site_settings")
    .select("club_id, enabled, published, domain, hero_image_path, primary_color, secondary_color, accent_color, font_family, whatsapp_url_or_phone, instagram_url, section_visibility")
    .eq("club_id", club.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return normalizeClubSiteSettings((data ?? null) as ClubSiteSettingsRow | null, club);
}

async function loadClubProducts(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  clubId: string
) {
  const { data, error } = await supabase
    .from("club_products")
    .select("id, club_id, name, slug, description, category, image_path, price_label, status, visible, sort_order, contact_channel, contact_url, contact_message, created_at, updated_at")
    .eq("club_id", clubId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return normalizeClubProducts((data ?? []) as ClubProductRow[]);
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
  if (!canAccessClubsProduct()) return [];

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
    { data: callups, error: callupsError },
    { data: callupPlayers, error: callupPlayersError },
    { data: callupGuests, error: callupGuestsError },
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
      .select("id, club_id, full_name, nickname, position, shirt_number, photo_path, default_payment_cents, notes, active, created_at")
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
      .from("club_callups")
      .select("id, club_id, club_team_id, scheduled_at, opponent_name, venue, status, ideal_player_count, max_player_count, target_payment_count, full_payment_cents, field_cost_cents, notes, created_at")
      .eq("club_id", clubId)
      .order("scheduled_at", { ascending: false }),
    supabase.from("club_callup_players").select("id, callup_id, club_player_id, status, expected_cents, notes, created_at, updated_at"),
    supabase.from("club_callup_guests").select("id, callup_id, guest_name, position, status, expected_cents, notes, created_at, updated_at"),
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
  if (callupsError) throw new Error(callupsError.message);
  if (callupPlayersError) throw new Error(callupPlayersError.message);
  if (callupGuestsError) throw new Error(callupGuestsError.message);
  if (matchesError) throw new Error(matchesError.message);
  if (lineupsError) throw new Error(lineupsError.message);
  if (statsError) throw new Error(statsError.message);
  if (paymentsError) throw new Error(paymentsError.message);
  if (!club) return null;

  const matchIds = new Set((matches ?? []).map((match) => String(match.id)));
  const callupIds = new Set((callups ?? []).map((callup) => String(callup.id)));
  const filteredLineups = ((lineups ?? []) as ClubLineupRecord[]).filter((lineup) =>
    matchIds.has(lineup.match_id)
  );
  const lineupIds = new Set(filteredLineups.map((lineup) => lineup.id));
  const filteredPayments = ((payments ?? []) as ClubMatchPaymentRecord[]).filter((payment) =>
    matchIds.has(payment.match_id) && lineupIds.has(payment.lineup_id)
  );
  const filteredCallupPlayers = ((callupPlayers ?? []) as ClubCallupPlayerRecord[]).filter((entry) =>
    callupIds.has(entry.callup_id)
  );
  const filteredCallupGuests = ((callupGuests ?? []) as ClubCallupGuestRecord[]).filter((guest) =>
    callupIds.has(guest.callup_id)
  );
  const playersRows = (players ?? []) as ClubPlayerRecord[];
  const callupRows = (callups ?? []) as ClubCallupRecord[];

  return {
    club: club as ClubRecord,
    players: playersRows,
    competitions: (competitions ?? []) as ClubCompetitionRecord[],
    teams: (teams ?? []) as ClubTeamRecord[],
    teamPlayers: ((teamPlayers ?? []) as ClubTeamPlayerRecord[]).filter((teamPlayer) =>
      ((teams ?? []) as ClubTeamRecord[]).some((team) => team.id === teamPlayer.club_team_id)
    ),
    callups: callupRows,
    callupPlayers: filteredCallupPlayers,
    callupGuests: filteredCallupGuests,
    callupSummaries: Object.fromEntries(
      callupRows.map((callup) => [
        callup.id,
        buildClubCallupSummary({
          callup,
          entries: filteredCallupPlayers.filter((entry) => entry.callup_id === callup.id),
          guests: filteredCallupGuests.filter((guest) => guest.callup_id === callup.id),
          players: playersRows
        })
      ])
    ),
    matches: (matches ?? []) as ClubMatchRecord[],
    lineups: filteredLineups,
    stats: ((stats ?? []) as ClubMatchPlayerStatRecord[]).filter((stat) => lineupIds.has(stat.lineup_id)),
    payments: filteredPayments
  };
}

export async function refreshClubPublicSnapshot(clubId: string) {
  if (!canAccessClubsProduct()) return null;

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
  if (!canAccessClubsProduct()) return null;

  noStore();
  const privateData = await loadClubPrivateData(clubId);
  if (!privateData) return null;

  const supabase = await createSupabaseServerClient();
  const [
    { data: snapshotRow, error: snapshotError },
    { data: adminsData, error: adminsError },
    { data: invitesData, error: invitesError },
    siteSettings,
    products
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
      .order("created_at", { ascending: false }),
    loadClubSiteSettings(supabase, privateData.club),
    loadClubProducts(supabase, clubId)
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
    siteSettings,
    products,
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
  if (!canAccessClubsProduct()) return null;

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

export async function getPublicClubSites(): Promise<PublicClubSiteListItem[]> {
  if (!canAccessClubsProduct()) return [];

  noStore();
  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  try {
    supabase = await createSupabaseServerClient();
  } catch (error) {
    if (shouldUseClubSiteDemoFallback() && isMissingSupabaseConfigurationError(error)) {
      return getDemoPublicClubSites();
    }
    throw error;
  }
  const { data: settingsRows, error: settingsError } = await supabase
    .from("club_site_settings")
    .select("club_id, enabled, published, domain, hero_image_path, primary_color, secondary_color, accent_color, font_family, whatsapp_url_or_phone, instagram_url, section_visibility")
    .eq("enabled", true)
    .eq("published", true);

  if (settingsError) {
    if (shouldUseClubSiteDemoFallback() && isMissingClubSiteSchemaError(settingsError)) {
      return getDemoPublicClubSites();
    }
    throw new Error(settingsError.message);
  }

  const settingsByClubId = new Map(
    ((settingsRows ?? []) as ClubSiteSettingsRow[]).map((row) => [row.club_id, row])
  );
  const clubIds = Array.from(settingsByClubId.keys());
  if (!clubIds.length) return shouldUseClubSiteDemoFallback() ? getDemoPublicClubSites() : [];

  const [
    { data: clubs, error: clubsError },
    { data: products, error: productsError }
  ] = await Promise.all([
    supabase
      .from("clubs")
      .select("id, name, slug, description, home_venue, logo_path, is_public, status, created_at")
      .in("id", clubIds)
      .eq("status", "active")
      .order("name", { ascending: true }),
    supabase
      .from("club_products")
      .select("id, club_id, name, slug, description, category, image_path, price_label, status, visible, sort_order, contact_channel, contact_url, contact_message, created_at, updated_at")
      .in("club_id", clubIds)
      .eq("visible", true)
  ]);

  if (clubsError) throw new Error(clubsError.message);
  if (productsError) {
    if (shouldUseClubSiteDemoFallback() && isMissingClubSiteSchemaError(productsError)) {
      return getDemoPublicClubSites();
    }
    throw new Error(productsError.message);
  }

  const visibleProducts = filterVisibleClubProducts(normalizeClubProducts((products ?? []) as ClubProductRow[]));
  const productCountByClubId = visibleProducts.reduce<Map<string, number>>((counts, product) => {
    counts.set(product.club_id, (counts.get(product.club_id) ?? 0) + 1);
    return counts;
  }, new Map());

  return ((clubs ?? []) as ClubRecord[]).map((club) => {
    const settings = normalizeClubSiteSettings(settingsByClubId.get(club.id), club);
    return {
      club,
      settings,
      productCount: productCountByClubId.get(club.id) ?? 0,
      publicHref: buildClubSitePublicHref(club, settings)
    };
  });
}

export async function getPublicClubSiteBySlug(slug: string): Promise<PublicClubSiteDetails | null> {
  if (!canAccessClubsProduct()) return null;

  noStore();
  let data: Awaited<ReturnType<typeof getPublicClubBySlug>>;
  try {
    data = await getPublicClubBySlug(slug);
  } catch (error) {
    const demo = shouldUseClubSiteDemoFallback() ? getDemoPublicClubSiteBySlug(slug) : null;
    if (demo && (isMissingClubSiteSchemaError(error) || isMissingSupabaseConfigurationError(error))) return demo;
    throw error;
  }
  if (!data) return shouldUseClubSiteDemoFallback() ? getDemoPublicClubSiteBySlug(slug) : null;

  const supabase = await createSupabaseServerClient();
  let settings: ClubSiteSettings;
  let products: ClubProductRecord[];
  try {
    [settings, products] = await Promise.all([
      loadClubSiteSettings(supabase, data.club),
      loadClubProducts(supabase, data.club.id)
    ]);
  } catch (error) {
    const demo = shouldUseClubSiteDemoFallback() ? getDemoPublicClubSiteBySlug(slug) : null;
    if (demo && isMissingClubSiteSchemaError(error)) return demo;
    throw error;
  }

  if (!settings.enabled || !settings.published || data.club.status !== "active") return null;

  return {
    club: data.club,
    settings,
    products: filterVisibleClubProducts(products),
    snapshot: data.snapshot
  };
}

export async function getPublicClubSiteByDomain(host: string): Promise<PublicClubSiteDetails | null> {
  if (!canAccessClubsProduct()) return null;

  noStore();
  const normalizedHost = host.toLowerCase().replace(/^www\./, "").split(":")[0] ?? "";
  if (!normalizedHost) return null;

  const sites = await getPublicClubSites();
  const site = sites.find((item) => item.settings.domain?.toLowerCase().replace(/^www\./, "") === normalizedHost);
  if (!site) return null;

  return getPublicClubSiteBySlug(site.club.slug);
}
