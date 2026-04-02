-- RLS and grants for Fabrica de Futbol

grant usage on schema public to anon, authenticated;
grant select on table public.players, public.matches, public.match_players, public.match_guests, public.team_options, public.team_option_players, public.team_option_guests, public.match_result, public.rating_history, public.match_player_stats, public.public_match_cards to anon, authenticated;
grant insert, update, delete on table public.players, public.matches, public.match_players, public.match_guests, public.team_options, public.team_option_players, public.team_option_guests, public.match_result, public.rating_history, public.match_player_stats, public.admins to authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admins a
    where a.id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

alter table public.admins enable row level security;
alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.match_players enable row level security;
alter table public.match_guests enable row level security;
alter table public.team_options enable row level security;
alter table public.team_option_players enable row level security;
alter table public.team_option_guests enable row level security;
alter table public.match_result enable row level security;
alter table public.rating_history enable row level security;
alter table public.match_player_stats enable row level security;

drop policy if exists admins_select_self_or_admin on public.admins;
create policy admins_select_self_or_admin
on public.admins
for select
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists admins_write_admin_only on public.admins;
create policy admins_write_admin_only
on public.admins
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists players_public_read on public.players;
create policy players_public_read
on public.players
for select
to anon, authenticated
using (true);

drop policy if exists players_admin_write on public.players;
create policy players_admin_write
on public.players
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists matches_public_read on public.matches;
create policy matches_public_read
on public.matches
for select
to anon, authenticated
using (
  status in ('confirmed', 'finished', 'cancelled')
  or public.is_admin()
);

drop policy if exists matches_admin_write on public.matches;
create policy matches_admin_write
on public.matches
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists match_players_public_read on public.match_players;
create policy match_players_public_read
on public.match_players
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.matches m
    where m.id = match_players.match_id
      and (m.status in ('confirmed', 'finished', 'cancelled') or public.is_admin())
  )
);

drop policy if exists match_players_admin_write on public.match_players;
create policy match_players_admin_write
on public.match_players
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists match_guests_public_read on public.match_guests;
create policy match_guests_public_read
on public.match_guests
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.matches m
    where m.id = match_guests.match_id
      and (m.status in ('confirmed', 'finished', 'cancelled') or public.is_admin())
  )
);

drop policy if exists match_guests_admin_write on public.match_guests;
create policy match_guests_admin_write
on public.match_guests
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists team_options_public_read on public.team_options;
create policy team_options_public_read
on public.team_options
for select
to anon, authenticated
using (is_confirmed or public.is_admin());

drop policy if exists team_options_admin_write on public.team_options;
create policy team_options_admin_write
on public.team_options
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists team_option_players_public_read on public.team_option_players;
create policy team_option_players_public_read
on public.team_option_players
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.team_options opt
    where opt.id = team_option_players.team_option_id
      and (opt.is_confirmed or public.is_admin())
  )
);

drop policy if exists team_option_players_admin_write on public.team_option_players;
create policy team_option_players_admin_write
on public.team_option_players
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists team_option_guests_public_read on public.team_option_guests;
create policy team_option_guests_public_read
on public.team_option_guests
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.team_options opt
    where opt.id = team_option_guests.team_option_id
      and (opt.is_confirmed or public.is_admin())
  )
);

drop policy if exists team_option_guests_admin_write on public.team_option_guests;
create policy team_option_guests_admin_write
on public.team_option_guests
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists match_result_public_read on public.match_result;
create policy match_result_public_read
on public.match_result
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.matches m
    where m.id = match_result.match_id
      and (m.status = 'finished' or public.is_admin())
  )
);

drop policy if exists match_result_admin_write on public.match_result;
create policy match_result_admin_write
on public.match_result
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists rating_history_public_read on public.rating_history;
create policy rating_history_public_read
on public.rating_history
for select
to anon, authenticated
using (true);

drop policy if exists rating_history_admin_write on public.rating_history;
create policy rating_history_admin_write
on public.rating_history
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists match_player_stats_public_read on public.match_player_stats;
create policy match_player_stats_public_read
on public.match_player_stats
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.matches m
    where m.id = match_player_stats.match_id
      and (m.status = 'finished' or public.is_admin())
  )
);

drop policy if exists match_player_stats_admin_write on public.match_player_stats;
create policy match_player_stats_admin_write
on public.match_player_stats
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
