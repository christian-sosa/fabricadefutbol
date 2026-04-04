import { createSupabaseServerClient } from "@/lib/supabase/server";

function notNull<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function isGuestSchemaMissing(error: { message: string } | null) {
  if (!error) return false;
  return /match_guests|team_option_guests/i.test(error.message);
}

export async function getAdminDashboardData(organizationId: string) {
  const supabase = await createSupabaseServerClient();

  const [
    { count: draftsCount, error: draftsError },
    { count: confirmedCount, error: confirmedError },
    { count: finishedCount, error: finishedError },
    { data: latestMatches, error: latestMatchesError }
  ] = await Promise.all([
    supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "draft"),
    supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "confirmed"),
    supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "finished"),
    supabase
      .from("matches")
      .select("id, scheduled_at, modality, status")
      .eq("organization_id", organizationId)
      .order("scheduled_at", { ascending: false })
      .limit(8)
  ]);

  if (draftsError) throw new Error(draftsError.message);
  if (confirmedError) throw new Error(confirmedError.message);
  if (finishedError) throw new Error(finishedError.message);
  if (latestMatchesError) throw new Error(latestMatchesError.message);

  return {
    draftsCount: draftsCount ?? 0,
    confirmedCount: confirmedCount ?? 0,
    finishedCount: finishedCount ?? 0,
    latestMatches: latestMatches ?? []
  };
}

export async function getOrganizationAdminData(organizationId: string) {
  const supabase = await createSupabaseServerClient();

  const [{ data: adminsData, error: adminsError }, { data: invitesData, error: invitesError }] = await Promise.all([
    supabase
      .from("organization_admins")
      .select("id, admin_id, created_at, admins!organization_admins_admin_id_fkey(id, display_name)")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true }),
    supabase
      .from("organization_invites")
      .select("id, email, invite_token, status, created_at")
      .eq("organization_id", organizationId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
  ]);

  if (adminsError) throw new Error(adminsError.message);
  if (invitesError) throw new Error(invitesError.message);

  const admins = (adminsData ?? []).map((row) => {
    const relation = row.admins;
    const adminRow = Array.isArray(relation) ? relation[0] : relation;

    return {
      id: row.admin_id,
      displayName: adminRow?.display_name ?? "Admin",
      createdAt: row.created_at
    };
  });

  const pendingInvites = (invitesData ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    inviteToken: row.invite_token,
    status: row.status,
    createdAt: row.created_at
  }));

  return {
    admins,
    pendingInvites
  };
}

export async function getAdminPlayers(organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("organization_id", organizationId)
    .order("initial_rank", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getSelectablePlayers(organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("players")
    .select("id, full_name, current_rating, initial_rank")
    .eq("organization_id", organizationId)
    .eq("active", true)
    .order("initial_rank", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getAdminMatchDetails(matchId: string, organizationId: string) {
  const supabase = await createSupabaseServerClient();

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (matchError) throw new Error(matchError.message);
  if (!match) return null;

  const [{ data: matchPlayers, error: matchPlayersError }, { data: matchGuests, error: matchGuestsError }] =
    await Promise.all([
      supabase.from("match_players").select("player_id").eq("match_id", matchId),
      supabase.from("match_guests").select("id, guest_name, guest_rating").eq("match_id", matchId)
    ]);
  if (matchPlayersError) throw new Error(matchPlayersError.message);
  if (matchGuestsError && !isGuestSchemaMissing(matchGuestsError)) throw new Error(matchGuestsError.message);
  const safeMatchGuests = matchGuestsError && isGuestSchemaMissing(matchGuestsError) ? [] : matchGuests ?? [];

  const playerIds = (matchPlayers ?? []).map((row) => row.player_id);
  const { data: players, error: playersError } = playerIds.length
    ? await supabase
        .from("players")
        .select("id, full_name, current_rating")
        .eq("organization_id", organizationId)
        .in("id", playerIds)
    : { data: [], error: null };
  if (playersError) throw new Error(playersError.message);
  const playersById = new Map((players ?? []).map((player) => [player.id, player]));
  const guestsById = new Map(safeMatchGuests.map((guest) => [guest.id, guest]));

  const { data: options, error: optionsError } = await supabase
    .from("team_options")
    .select("*")
    .eq("match_id", matchId)
    .order("option_number", { ascending: true });
  if (optionsError) throw new Error(optionsError.message);

  const optionIds = (options ?? []).map((option) => option.id);
  const [{ data: optionPlayers, error: optionPlayersError }, { data: optionGuests, error: optionGuestsError }] =
    optionIds.length
      ? await Promise.all([
          supabase
            .from("team_option_players")
            .select("team_option_id, player_id, team")
            .in("team_option_id", optionIds),
          supabase
            .from("team_option_guests")
            .select("team_option_id, guest_id, team")
            .in("team_option_id", optionIds)
        ])
      : [{ data: [], error: null }, { data: [], error: null }];
  if (optionPlayersError) throw new Error(optionPlayersError.message);
  if (optionGuestsError && !isGuestSchemaMissing(optionGuestsError)) throw new Error(optionGuestsError.message);
  const safeOptionGuests = optionGuestsError && isGuestSchemaMissing(optionGuestsError) ? [] : optionGuests ?? [];

  const optionsWithPlayers =
    options?.map((option) => {
      const memberPlayers = (optionPlayers ?? []).filter((player) => player.team_option_id === option.id);
      const memberGuests = safeOptionGuests.filter((guest) => guest.team_option_id === option.id);
      const teamAFromPlayers = memberPlayers
        .filter((member) => member.team === "A")
        .map((member) => playersById.get(member.player_id))
        .filter(notNull)
        .map((player) => ({ ...player, is_guest: false }));
      const teamAFromGuests = memberGuests
        .filter((member) => member.team === "A")
        .map((member) => guestsById.get(member.guest_id))
        .filter(notNull)
        .map((guest) => ({
          id: guest.id,
          full_name: guest.guest_name,
          current_rating: Number(guest.guest_rating),
          is_guest: true
        }));
      const teamBFromPlayers = memberPlayers
        .filter((member) => member.team === "B")
        .map((member) => playersById.get(member.player_id))
        .filter(notNull)
        .map((player) => ({ ...player, is_guest: false }));
      const teamBFromGuests = memberGuests
        .filter((member) => member.team === "B")
        .map((member) => guestsById.get(member.guest_id))
        .filter(notNull)
        .map((guest) => ({
          id: guest.id,
          full_name: guest.guest_name,
          current_rating: Number(guest.guest_rating),
          is_guest: true
        }));

      const teamA = [...teamAFromPlayers, ...teamAFromGuests];
      const teamB = [...teamBFromPlayers, ...teamBFromGuests];

      return {
        ...option,
        teamA,
        teamB
      };
    }) ?? [];

  const { data: result, error: resultError } = await supabase
    .from("match_result")
    .select("*")
    .eq("match_id", matchId)
    .maybeSingle();
  if (resultError) throw new Error(resultError.message);

  const rosterPlayers = (matchPlayers ?? [])
    .map((row) => playersById.get(row.player_id))
    .filter((player): player is NonNullable<typeof player> => Boolean(player))
    .map((player) => ({ ...player, is_guest: false }));
  const rosterGuests = safeMatchGuests.map((guest) => ({
    id: guest.id,
    full_name: guest.guest_name,
    current_rating: Number(guest.guest_rating),
    is_guest: true
  }));
  const roster = [...rosterPlayers, ...rosterGuests];

  return {
    match,
    roster,
    options: optionsWithPlayers,
    result
  };
}
