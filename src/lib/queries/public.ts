import { cookies } from "next/headers";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ACTIVE_ORG_COOKIE } from "@/lib/active-org";
import { SUPER_ADMIN_EMAIL } from "@/lib/constants";
import { calculatePlayerStats, type MatchWithTeams } from "@/lib/domain/stats";
import { normalizeEmail } from "@/lib/org";
import type { Database } from "@/types/database";

type MatchRow = Database["public"]["Tables"]["matches"]["Row"];

type PublicOrganization = {
  id: string;
  name: string;
  slug: string;
  is_public: boolean;
  created_at: string;
};

function findOrganizationByKey(organizations: PublicOrganization[], organizationKey?: string | null) {
  if (!organizationKey) return null;
  const normalizedKey = organizationKey.trim().toLowerCase();
  if (!normalizedKey) return null;

  return (
    organizations.find(
      (organization) => organization.slug.toLowerCase() === normalizedKey || organization.id === organizationKey
    ) ?? null
  );
}

function indexBy<T extends { id: string }>(rows: T[]) {
  return new Map(rows.map((row) => [row.id, row]));
}

function notNull<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function isGuestSchemaMissing(error: { message: string } | null) {
  if (!error) return false;
  return /match_guests|team_option_guests/i.test(error.message);
}

type MatchParticipantDisplay = {
  id: string;
  full_name: string;
  current_rating: number;
  is_guest: boolean;
};

function sortParticipantsByRating(players: MatchParticipantDisplay[]) {
  return [...players].sort((a, b) => Number(b.current_rating) - Number(a.current_rating));
}

function hashString(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function getDefaultOrganizationIndex(organizations: PublicOrganization[], context?: "home" | "ranking") {
  if (!organizations.length) return -1;
  if (!context) return 0;
  if (organizations.length === 1) return 0;

  const dayKey = new Date().toISOString().slice(0, 10);
  const baseIndex = hashString(dayKey) % organizations.length;

  if (context === "home") return baseIndex;
  if (context === "ranking") return (baseIndex + 1) % organizations.length;
  return 0;
}

export async function getPublicOrganizations(): Promise<PublicOrganization[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, slug, is_public, created_at")
    .eq("is_public", true)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getViewerAdminOrganizations(): Promise<PublicOrganization[]> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user?.id || !user.email) return [];

  const normalizedEmail = normalizeEmail(user.email);
  if (SUPER_ADMIN_EMAIL && normalizedEmail.length > 0 && normalizedEmail === SUPER_ADMIN_EMAIL) {
    const { data, error } = await supabase
      .from("organizations")
      .select("id, name, slug, is_public, created_at")
      .order("name", { ascending: true });

    if (error) throw new Error(error.message);
    return data ?? [];
  }

  const { data, error } = await supabase
    .from("organization_admins")
    .select("organizations(id, name, slug, is_public, created_at)")
    .eq("admin_id", user.id);

  if (error) throw new Error(error.message);

  const organizations = (data ?? [])
    .map((row) => {
      const relation = row.organizations;
      if (Array.isArray(relation)) return relation[0] ?? null;
      return relation ?? null;
    })
    .filter(
      (value): value is PublicOrganization =>
        Boolean(value && typeof value.id === "string" && typeof value.name === "string" && typeof value.slug === "string")
    );

  return organizations.sort((a, b) => a.name.localeCompare(b.name, "es"));
}

function readActiveOrgCookieSafe(): string | null {
  try {
    return cookies().get(ACTIVE_ORG_COOKIE)?.value ?? null;
  } catch {
    // `cookies()` solo es accesible en render dinamico. En contextos estaticos
    // Next.js tira; en ese caso simplemente no hay cookie disponible.
    return null;
  }
}

export async function resolvePublicOrganization(
  preferredOrganizationKey?: string | null,
  options?: {
    defaultContext?: "home" | "ranking";
  }
) {
  const organizations = await getPublicOrganizations();
  // Orden de prioridad: query param -> cookie -> default contextual.
  const fromQuery = findOrganizationByKey(organizations, preferredOrganizationKey);
  const fromCookie = fromQuery ? null : findOrganizationByKey(organizations, readActiveOrgCookieSafe());
  const selectedOrganization =
    fromQuery ??
    fromCookie ??
    organizations[getDefaultOrganizationIndex(organizations, options?.defaultContext)] ??
    null;

  return {
    organizations,
    selectedOrganization
  };
}

async function resolvePublicOrganizationId(organizationKey?: string | null) {
  const organizations = await getPublicOrganizations();
  return findOrganizationByKey(organizations, organizationKey)?.id ?? null;
}

async function fetchMatchTeams(matchIds: string[]) {
  if (!matchIds.length) return [] as MatchWithTeams[];

  const supabase = await createSupabaseServerClient();

  const { data: matches, error: matchesError } = await supabase
    .from("matches")
    .select("*")
    .in("id", matchIds);
  if (matchesError) throw new Error(matchesError.message);

  const { data: results, error: resultsError } = await supabase
    .from("match_result")
    .select("*")
    .in("match_id", matchIds);
  if (resultsError) throw new Error(resultsError.message);

  const { data: confirmedOptions, error: optionsError } = await supabase
    .from("team_options")
    .select("id, match_id")
    .in("match_id", matchIds)
    .eq("is_confirmed", true);
  if (optionsError) throw new Error(optionsError.message);

  const optionIds = (confirmedOptions ?? []).map((option) => option.id);
  const { data: optionPlayers, error: optionPlayersError } = optionIds.length
    ? await supabase
        .from("team_option_players")
        .select("team_option_id, player_id, team")
        .in("team_option_id", optionIds)
    : { data: [], error: null };
  if (optionPlayersError) throw new Error(optionPlayersError.message);

  const matchesById = indexBy(matches ?? []);
  const resultByMatchId = new Map((results ?? []).map((result) => [result.match_id, result]));
  const optionByMatchId = new Map((confirmedOptions ?? []).map((option) => [option.match_id, option.id]));

  const playersByOptionId = new Map<string, { teamA: string[]; teamB: string[] }>();

  for (const optionPlayer of optionPlayers ?? []) {
    const current = playersByOptionId.get(optionPlayer.team_option_id) ?? {
      teamA: [],
      teamB: []
    };
    if (optionPlayer.team === "A") current.teamA.push(optionPlayer.player_id);
    if (optionPlayer.team === "B") current.teamB.push(optionPlayer.player_id);
    playersByOptionId.set(optionPlayer.team_option_id, current);
  }

  return matchIds
    .map((matchId) => {
      const match = matchesById.get(matchId);
      if (!match) return null;
      const optionId = optionByMatchId.get(matchId);
      const teams = optionId ? playersByOptionId.get(optionId) : undefined;

      return {
        match,
        result: resultByMatchId.get(matchId) ?? null,
        teamAPlayerIds: teams?.teamA ?? [],
        teamBPlayerIds: teams?.teamB ?? []
      } satisfies MatchWithTeams;
    })
    .filter((item): item is MatchWithTeams => item !== null);
}

export async function getHomeSummary(organizationId: string | null) {
  if (!organizationId) {
    return {
      totalPlayers: 0,
      totalFinishedMatches: 0,
      upcomingMatches: [],
      topPlayers: []
    };
  }

  const supabase = await createSupabaseServerClient();

  const [playersRes, upcomingRes, finishedRes] = await Promise.all([
    supabase
      .from("players")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("active", true),
    supabase
      .from("matches")
      .select("id, scheduled_at, modality, status")
      .eq("organization_id", organizationId)
      .eq("status", "confirmed")
      .gt("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(5),
    supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "finished")
  ]);

  if (playersRes.error) throw new Error(playersRes.error.message);
  if (upcomingRes.error) throw new Error(upcomingRes.error.message);
  if (finishedRes.error) throw new Error(finishedRes.error.message);

  const { data: topPlayers, error: topPlayersError } = await supabase
    .from("players")
    .select("id, full_name, current_rating, initial_rank")
    .eq("organization_id", organizationId)
    .eq("active", true)
    .order("current_rating", { ascending: false })
    .limit(5);
  if (topPlayersError) throw new Error(topPlayersError.message);

  return {
    totalPlayers: playersRes.count ?? 0,
    totalFinishedMatches: finishedRes.count ?? 0,
    upcomingMatches: upcomingRes.data ?? [],
    topPlayers: topPlayers ?? []
  };
}

export async function getRankingPlayers(organizationId: string | null) {
  if (!organizationId) return [];

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("players")
    .select("id, full_name, current_rating, initial_rank")
    .eq("organization_id", organizationId)
    .eq("active", true)
    .order("current_rating", { ascending: false })
    .order("initial_rank", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getPlayersWithStats(organizationId: string | null) {
  if (!organizationId) return [];

  const supabase = await createSupabaseServerClient();
  const { data: players, error: playersError } = await supabase
    .from("players")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("active", true)
    .order("current_rating", { ascending: false })
    .order("initial_rank", { ascending: true });
  if (playersError) throw new Error(playersError.message);

  const { data: finishedMatches, error: matchesError } = await supabase
    .from("matches")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("status", "finished")
    .order("scheduled_at", { ascending: true });
  if (matchesError) throw new Error(matchesError.message);

  const matchIds = (finishedMatches ?? []).map((match) => match.id);
  const finishedWithTeams = await fetchMatchTeams(matchIds);

  const { data: matchPlayerStats, error: statsError } = await supabase
    .from("match_player_stats")
    .select("*")
    .in("match_id", matchIds.length ? matchIds : ["00000000-0000-0000-0000-000000000000"]);
  if (statsError && matchIds.length) throw new Error(statsError.message);

  return calculatePlayerStats({
    players: players ?? [],
    finishedMatches: finishedWithTeams,
    matchPlayerStats: matchPlayerStats ?? []
  });
}

export async function getPlayerDetails(playerId: string, organizationKey?: string | null) {
  const supabase = await createSupabaseServerClient();
  let query = supabase.from("players").select("*").eq("id", playerId);

  if (organizationKey) {
    const organizationId = await resolvePublicOrganizationId(organizationKey);
    if (!organizationId) return null;
    query = query.eq("organization_id", organizationId);
  }

  const { data: player, error: playerError } = await query.maybeSingle();
  if (playerError) throw new Error(playerError.message);
  if (!player) return null;

  const allStats = await getPlayersWithStats(player.organization_id);
  const playerStats = allStats.find((item) => item.playerId === playerId);

  const { data: ratingHistory, error: ratingHistoryError } = await supabase
    .from("rating_history")
    .select("id, match_id, rating_before, rating_after, delta, created_at")
    .eq("player_id", playerId)
    .order("created_at", { ascending: false })
    .limit(12);
  if (ratingHistoryError) throw new Error(ratingHistoryError.message);

  return {
    player,
    playerStats,
    ratingHistory: ratingHistory ?? []
  };
}

function normalizeMatchCard(match: MatchRow, result?: Database["public"]["Tables"]["match_result"]["Row"] | null) {
  return {
    id: match.id,
    scheduledAt: match.scheduled_at,
    modality: match.modality,
    status: match.status,
    scoreA: result?.score_a ?? null,
    scoreB: result?.score_b ?? null,
    winnerTeam: result?.winner_team ?? null
  };
}

function normalizePositiveInteger(value: number | undefined, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.floor(value as number));
}

export async function getMatchHistoryCardsPage(
  organizationId: string | null,
  params?: {
    page?: number;
    pageSize?: number;
  }
) {
  const page = normalizePositiveInteger(params?.page, 1);
  const pageSize = Math.min(10, normalizePositiveInteger(params?.pageSize, 10));

  if (!organizationId) {
    return {
      organizationId: null,
      matches: [],
      pagination: {
        page,
        pageSize,
        totalCount: 0,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: page > 1
      }
    };
  }

  const supabase = await createSupabaseServerClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data: finishedMatches, error, count } = await supabase
    .from("matches")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId)
    .in("status", ["finished", "cancelled"])
    .order("scheduled_at", { ascending: false })
    .range(from, to);
  if (error) throw new Error(error.message);

  const ids = (finishedMatches ?? []).map((match) => match.id);
  const withTeams = await fetchMatchTeams(ids);
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    organizationId,
    matches: withTeams.map((row) => normalizeMatchCard(row.match, row.result)),
    pagination: {
      page,
      pageSize,
      totalCount: total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1
    }
  };
}

export async function getMatchHistoryCards(organizationId: string | null) {
  const data = await getMatchHistoryCardsPage(organizationId, {
    page: 1,
    pageSize: 10
  });
  return data.matches;
}

export async function getUpcomingConfirmedMatches(organizationId: string | null) {
  if (!organizationId) return [];

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("status", "confirmed")
    .order("scheduled_at", { ascending: true });
  if (error) throw new Error(error.message);

  const ids = (data ?? []).map((match) => match.id);
  const matchesWithTeams = await fetchMatchTeams(ids);
  const playerIds = matchesWithTeams.flatMap((match) => [...match.teamAPlayerIds, ...match.teamBPlayerIds]);
  const optionIds = matchesWithTeams.map((match) => match.match.confirmed_option_id).filter(notNull);

  const { data: players, error: playersError } = playerIds.length
    ? await supabase
        .from("players")
        .select("id, full_name, current_rating")
        .eq("organization_id", organizationId)
        .in("id", playerIds)
    : { data: [], error: null };
  if (playersError) throw new Error(playersError.message);

  const { data: optionGuests, error: optionGuestsError } = optionIds.length
    ? await supabase
        .from("team_option_guests")
        .select("team_option_id, guest_id, team")
        .in("team_option_id", optionIds)
    : { data: [], error: null };
  if (optionGuestsError && !isGuestSchemaMissing(optionGuestsError)) throw new Error(optionGuestsError.message);

  const safeOptionGuests = optionGuestsError && isGuestSchemaMissing(optionGuestsError) ? [] : optionGuests ?? [];
  const guestIds = safeOptionGuests.map((guest) => guest.guest_id);
  const { data: guests, error: guestsError } = guestIds.length
    ? await supabase.from("match_guests").select("id, guest_name, guest_rating").in("id", guestIds)
    : { data: [], error: null };
  if (guestsError && !isGuestSchemaMissing(guestsError)) throw new Error(guestsError.message);
  const safeGuests = guestsError && isGuestSchemaMissing(guestsError) ? [] : guests ?? [];

  const playersById = new Map(
    (players ?? []).map((player) => [
      player.id,
      {
        ...player,
        is_guest: false
      }
    ])
  );
  const guestsById = new Map(
    safeGuests.map((guest) => [
      guest.id,
      {
        id: `guest-${guest.id}`,
        full_name: guest.guest_name,
        current_rating: Number(guest.guest_rating),
        is_guest: true
      }
    ])
  );

  return matchesWithTeams.map((item) => ({
    ...item,
    teamAPlayers: sortParticipantsByRating([
      ...item.teamAPlayerIds.map((id) => playersById.get(id)).filter(notNull),
      ...safeOptionGuests
        .filter((guest) => guest.team_option_id === item.match.confirmed_option_id && guest.team === "A")
        .map((guest) => guestsById.get(guest.guest_id))
        .filter(notNull)
    ]),
    teamBPlayers: sortParticipantsByRating([
      ...item.teamBPlayerIds.map((id) => playersById.get(id)).filter(notNull),
      ...safeOptionGuests
        .filter((guest) => guest.team_option_id === item.match.confirmed_option_id && guest.team === "B")
        .map((guest) => guestsById.get(guest.guest_id))
        .filter(notNull)
    ])
  }));
}

export async function getMatchDetails(matchId: string, organizationKey?: string | null) {
  const supabase = await createSupabaseServerClient();
  let query = supabase.from("matches").select("*").eq("id", matchId);

  if (organizationKey) {
    const organizationId = await resolvePublicOrganizationId(organizationKey);
    if (!organizationId) return null;
    query = query.eq("organization_id", organizationId);
  }

  const { data: match, error: matchError } = await query.maybeSingle();
  if (matchError) throw new Error(matchError.message);
  if (!match) return null;

  const withTeams = await fetchMatchTeams([matchId]);
  const details = withTeams[0];
  if (!details) {
    return {
      match,
      result: null,
      teamAPlayers: [],
      teamBPlayers: []
    };
  }

  const playerIds = [...details.teamAPlayerIds, ...details.teamBPlayerIds];
  const { data: players, error: playersError } = playerIds.length
    ? await supabase
        .from("players")
        .select("id, full_name, current_rating")
        .eq("organization_id", match.organization_id)
        .in("id", playerIds)
    : { data: [], error: null };
  if (playersError) throw new Error(playersError.message);

  const { data: optionGuests, error: optionGuestsError } = details.match.confirmed_option_id
    ? await supabase
        .from("team_option_guests")
        .select("team_option_id, guest_id, team")
        .eq("team_option_id", details.match.confirmed_option_id)
    : { data: [], error: null };
  if (optionGuestsError && !isGuestSchemaMissing(optionGuestsError)) throw new Error(optionGuestsError.message);

  const safeOptionGuests = optionGuestsError && isGuestSchemaMissing(optionGuestsError) ? [] : optionGuests ?? [];
  const guestIds = safeOptionGuests.map((guest) => guest.guest_id);
  const { data: guests, error: guestsError } = guestIds.length
    ? await supabase.from("match_guests").select("id, guest_name, guest_rating").in("id", guestIds)
    : { data: [], error: null };
  if (guestsError && !isGuestSchemaMissing(guestsError)) throw new Error(guestsError.message);
  const safeGuests = guestsError && isGuestSchemaMissing(guestsError) ? [] : guests ?? [];

  const playersById = new Map(
    (players ?? []).map((player) => [
      player.id,
      {
        ...player,
        is_guest: false
      }
    ])
  );
  const guestsById = new Map(
    safeGuests.map((guest) => [
      guest.id,
      {
        id: `guest-${guest.id}`,
        full_name: guest.guest_name,
        current_rating: Number(guest.guest_rating),
        is_guest: true
      }
    ])
  );

  return {
    match: details.match,
    result: details.result,
    teamAPlayers: sortParticipantsByRating([
      ...details.teamAPlayerIds.map((id) => playersById.get(id)).filter(notNull),
      ...safeOptionGuests
        .filter((guest) => guest.team === "A")
        .map((guest) => guestsById.get(guest.guest_id))
        .filter(notNull)
    ]),
    teamBPlayers: sortParticipantsByRating([
      ...details.teamBPlayerIds.map((id) => playersById.get(id)).filter(notNull),
      ...safeOptionGuests
        .filter((guest) => guest.team === "B")
        .map((guest) => guestsById.get(guest.guest_id))
        .filter(notNull)
    ])
  };
}
