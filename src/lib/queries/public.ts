import { createSupabaseServerClient } from "@/lib/supabase/server";
import { calculatePlayerStats, type MatchWithTeams } from "@/lib/domain/stats";
import type { Database } from "@/types/database";

type MatchRow = Database["public"]["Tables"]["matches"]["Row"];

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

export async function getHomeSummary() {
  const supabase = await createSupabaseServerClient();

  const [playersRes, upcomingRes, finishedRes] = await Promise.all([
    supabase.from("players").select("id", { count: "exact", head: true }).eq("active", true),
    supabase
      .from("matches")
      .select("id, scheduled_at, modality, status")
      .eq("status", "confirmed")
      .gt("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(5),
    supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("status", "finished")
  ]);

  if (playersRes.error) throw new Error(playersRes.error.message);
  if (upcomingRes.error) throw new Error(upcomingRes.error.message);
  if (finishedRes.error) throw new Error(finishedRes.error.message);

  const { data: topPlayers, error: topPlayersError } = await supabase
    .from("players")
    .select("id, full_name, current_rating, initial_rank")
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

export async function getRankingPlayers() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("players")
    .select("id, full_name, current_rating, initial_rank")
    .eq("active", true)
    .order("current_rating", { ascending: false })
    .order("initial_rank", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getPlayersWithStats() {
  const supabase = await createSupabaseServerClient();
  const { data: players, error: playersError } = await supabase
    .from("players")
    .select("*")
    .eq("active", true)
    .order("current_rating", { ascending: false })
    .order("initial_rank", { ascending: true });
  if (playersError) throw new Error(playersError.message);

  const { data: finishedMatches, error: matchesError } = await supabase
    .from("matches")
    .select("*")
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

export async function getPlayerDetails(playerId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: player, error: playerError } = await supabase.from("players").select("*").eq("id", playerId).maybeSingle();
  if (playerError) throw new Error(playerError.message);
  if (!player) return null;

  const allStats = await getPlayersWithStats();
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

export async function getMatchHistoryCards() {
  const supabase = await createSupabaseServerClient();
  const { data: finishedMatches, error } = await supabase
    .from("matches")
    .select("*")
    .in("status", ["finished", "cancelled"])
    .order("scheduled_at", { ascending: false });
  if (error) throw new Error(error.message);

  const ids = (finishedMatches ?? []).map((match) => match.id);
  const withTeams = await fetchMatchTeams(ids);
  return withTeams.map((row) => normalizeMatchCard(row.match, row.result));
}

export async function getUpcomingConfirmedMatches() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .eq("status", "confirmed")
    .gte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true });
  if (error) throw new Error(error.message);

  const ids = (data ?? []).map((match) => match.id);
  const matchesWithTeams = await fetchMatchTeams(ids);
  const playerIds = matchesWithTeams.flatMap((match) => [...match.teamAPlayerIds, ...match.teamBPlayerIds]);
  const optionIds = matchesWithTeams.map((match) => match.match.confirmed_option_id).filter(notNull);

  const { data: players, error: playersError } = playerIds.length
    ? await supabase.from("players").select("id, full_name, current_rating").in("id", playerIds)
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

export async function getMatchDetails(matchId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: match, error: matchError } = await supabase.from("matches").select("*").eq("id", matchId).maybeSingle();
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
    ? await supabase.from("players").select("id, full_name, current_rating").in("id", playerIds)
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
