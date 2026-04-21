create table if not exists public.tournament_team_captains (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  team_id uuid not null references public.tournament_teams(id) on delete cascade,
  captain_id uuid not null references public.admins(id) on delete cascade,
  created_by uuid references public.admins(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (team_id),
  unique (tournament_id, captain_id)
);

create table if not exists public.tournament_captain_invites (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  team_id uuid not null references public.tournament_teams(id) on delete cascade,
  email text not null,
  invite_token text not null,
  created_by uuid not null references public.admins(id) on delete restrict,
  expires_at timestamptz not null default (timezone('utc', now()) + interval '14 days'),
  created_at timestamptz not null default timezone('utc', now()),
  unique (team_id),
  unique (invite_token)
);

create index if not exists idx_tournament_team_captains_tournament
  on public.tournament_team_captains(tournament_id);
create index if not exists idx_tournament_team_captains_captain
  on public.tournament_team_captains(captain_id);
create index if not exists idx_tournament_captain_invites_tournament
  on public.tournament_captain_invites(tournament_id);
create index if not exists idx_tournament_captain_invites_email
  on public.tournament_captain_invites(lower(email));

grant select, insert, update, delete on table public.tournament_team_captains to authenticated;
grant select, insert, update, delete on table public.tournament_captain_invites to authenticated;
grant select, insert, update, delete on table public.tournament_team_captains, public.tournament_captain_invites to service_role;

create or replace function public.is_tournament_captain(tournament_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tournament_team_captains ttc
    where ttc.tournament_id = is_tournament_captain.tournament_id
      and ttc.captain_id = auth.uid()
  );
$$;

create or replace function public.is_tournament_team_captain(team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tournament_team_captains ttc
    where ttc.team_id = is_tournament_team_captain.team_id
      and ttc.captain_id = auth.uid()
  );
$$;

create or replace function public.can_read_tournament(tournament_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tournaments t
    where t.id = can_read_tournament.tournament_id
      and t.is_public = true
  )
  or public.is_tournament_admin(tournament_id)
  or public.is_tournament_captain(tournament_id);
$$;

revoke all on function public.is_tournament_captain(uuid) from public;
revoke all on function public.is_tournament_team_captain(uuid) from public;
grant execute on function public.is_tournament_captain(uuid) to anon, authenticated;
grant execute on function public.is_tournament_team_captain(uuid) to anon, authenticated;
grant execute on function public.can_read_tournament(uuid) to anon, authenticated;

alter table public.tournament_team_captains enable row level security;
alter table public.tournament_captain_invites enable row level security;

drop policy if exists tournaments_public_read on public.tournaments;
create policy tournaments_public_read
on public.tournaments
for select
to anon, authenticated
using (public.can_read_tournament(id));

drop policy if exists tournament_team_captains_select on public.tournament_team_captains;
create policy tournament_team_captains_select
on public.tournament_team_captains
for select
to authenticated
using (
  captain_id = auth.uid()
  or public.is_tournament_admin(tournament_id)
);

drop policy if exists tournament_team_captains_insert_admin on public.tournament_team_captains;
create policy tournament_team_captains_insert_admin
on public.tournament_team_captains
for insert
to authenticated
with check (public.is_tournament_admin(tournament_id));

drop policy if exists tournament_team_captains_insert_from_invite on public.tournament_team_captains;
create policy tournament_team_captains_insert_from_invite
on public.tournament_team_captains
for insert
to authenticated
with check (
  captain_id = auth.uid()
  and exists (
    select 1
    from public.tournament_captain_invites invites
    where invites.tournament_id = tournament_team_captains.tournament_id
      and invites.team_id = tournament_team_captains.team_id
      and lower(invites.email) = public.current_user_email()
      and invites.expires_at > timezone('utc', now())
  )
);

drop policy if exists tournament_team_captains_delete_admin on public.tournament_team_captains;
create policy tournament_team_captains_delete_admin
on public.tournament_team_captains
for delete
to authenticated
using (public.is_tournament_admin(tournament_id));

drop policy if exists tournament_captain_invites_select on public.tournament_captain_invites;
create policy tournament_captain_invites_select
on public.tournament_captain_invites
for select
to authenticated
using (
  public.is_tournament_admin(tournament_id)
  or (
    lower(email) = public.current_user_email()
    and expires_at > timezone('utc', now())
  )
);

drop policy if exists tournament_captain_invites_insert_admin on public.tournament_captain_invites;
create policy tournament_captain_invites_insert_admin
on public.tournament_captain_invites
for insert
to authenticated
with check (public.is_tournament_admin(tournament_id));

drop policy if exists tournament_captain_invites_delete_manage on public.tournament_captain_invites;
create policy tournament_captain_invites_delete_manage
on public.tournament_captain_invites
for delete
to authenticated
using (
  public.is_tournament_admin(tournament_id)
  or (
    lower(email) = public.current_user_email()
    and expires_at > timezone('utc', now())
  )
);

drop policy if exists tournament_players_captain_write on public.tournament_players;
create policy tournament_players_captain_write
on public.tournament_players
for all
to authenticated
using (
  exists (
    select 1
    from public.tournament_teams tt
    where tt.id = tournament_players.team_id
      and tt.tournament_id = tournament_players.tournament_id
      and public.is_tournament_team_captain(tt.id)
  )
)
with check (
  exists (
    select 1
    from public.tournament_teams tt
    where tt.id = tournament_players.team_id
      and tt.tournament_id = tournament_players.tournament_id
      and public.is_tournament_team_captain(tt.id)
  )
);

drop policy if exists tournament_match_results_public_read on public.tournament_match_results;
create policy tournament_match_results_public_read
on public.tournament_match_results
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.tournament_matches tm
    join public.tournaments t on t.id = tm.tournament_id
    where tm.id = tournament_match_results.match_id
      and (
        (
          tm.status = 'played'
          and t.is_public = true
        )
        or public.is_tournament_admin(t.id)
        or public.is_tournament_captain(t.id)
      )
  )
);

drop policy if exists tournament_match_player_stats_public_read on public.tournament_match_player_stats;
create policy tournament_match_player_stats_public_read
on public.tournament_match_player_stats
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.tournament_matches tm
    join public.tournaments t on t.id = tm.tournament_id
    where tm.id = tournament_match_player_stats.match_id
      and (
        (
          tm.status = 'played'
          and t.is_public = true
        )
        or public.is_tournament_admin(t.id)
        or public.is_tournament_captain(t.id)
      )
  )
);

create or replace function public.can_manage_player_photo_object(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  schema_name text := split_part(object_name, '/', 1);
  scope_name text := split_part(object_name, '/', 2);
  scope_id_text text;
  player_id_text text;
  has_access boolean := false;
  sql_query text;
begin
  if schema_name = '' or scope_name = '' then
    return false;
  end if;

  if scope_name = 'tournaments' then
    scope_id_text := split_part(object_name, '/', 3);
    player_id_text := split_part(split_part(object_name, '/', 4), '.', 1);

    if scope_id_text = '' or player_id_text = '' then
      return false;
    end if;

    if to_regclass(format('%I.tournament_players', schema_name)) is null then
      return false;
    end if;

    if to_regprocedure(format('%I.is_tournament_admin(uuid)', schema_name)) is null then
      return false;
    end if;

    if to_regprocedure(format('%I.is_tournament_team_captain(uuid)', schema_name)) is null then
      return false;
    end if;

    sql_query := format(
      'select exists (
         select 1
         from %1$I.tournament_players p
         where p.tournament_id::text = $1
           and p.id::text = $2
           and (
             %1$I.is_tournament_admin(p.tournament_id)
             or %1$I.is_tournament_team_captain(p.team_id)
           )
       )',
      schema_name
    );

    execute sql_query into has_access using scope_id_text, player_id_text;
    return coalesce(has_access, false);
  end if;

  scope_id_text := scope_name;
  player_id_text := split_part(split_part(object_name, '/', 3), '.', 1);

  if scope_id_text = '' or player_id_text = '' then
    return false;
  end if;

  if to_regclass(format('%I.players', schema_name)) is null then
    return false;
  end if;

  if to_regprocedure(format('%I.is_org_admin(uuid)', schema_name)) is null then
    return false;
  end if;

  sql_query := format(
    'select exists (
       select 1
       from %1$I.players p
       where p.organization_id::text = $1
         and p.id::text = $2
         and %1$I.is_org_admin(p.organization_id)
     )',
    schema_name
  );

  execute sql_query into has_access using scope_id_text, player_id_text;
  return coalesce(has_access, false);
exception
  when others then
    return false;
end;
$$;

revoke all on function public.can_manage_player_photo_object(text) from public;
grant execute on function public.can_manage_player_photo_object(text) to anon, authenticated;
