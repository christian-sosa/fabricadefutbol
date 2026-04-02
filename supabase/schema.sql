-- Supabase schema for Fabrica de Futbol
create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'match_modality') then
    create type public.match_modality as enum ('5v5', '6v6', '7v7');
  end if;
  if not exists (select 1 from pg_type where typname = 'match_status') then
    create type public.match_status as enum ('draft', 'confirmed', 'finished', 'cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'team_side') then
    create type public.team_side as enum ('A', 'B');
  end if;
  if not exists (select 1 from pg_type where typname = 'winner_team') then
    create type public.winner_team as enum ('A', 'B', 'DRAW');
  end if;
end
$$;

do $$
begin
  alter type public.match_modality add value if not exists '5v5';
end
$$;

create table if not exists public.admins (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  full_name text not null unique,
  initial_rank integer not null unique check (initial_rank > 0),
  current_rating numeric(8,2) not null default 1000.00 check (current_rating > 0),
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  scheduled_at timestamptz not null,
  modality public.match_modality not null,
  status public.match_status not null default 'draft',
  location text,
  created_by uuid not null references public.admins(id) on delete restrict,
  confirmed_option_id uuid,
  finished_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.match_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  unique (match_id, player_id)
);

create table if not exists public.match_guests (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  guest_name text not null,
  guest_rating numeric(8,2) not null check (guest_rating > 0),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.team_options (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  option_number integer not null check (option_number > 0),
  is_confirmed boolean not null default false,
  rating_sum_a numeric(10,2) not null,
  rating_sum_b numeric(10,2) not null,
  rating_diff numeric(10,2) not null check (rating_diff >= 0),
  created_by uuid not null references public.admins(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  unique (match_id, option_number)
);

create table if not exists public.team_option_players (
  id uuid primary key default gen_random_uuid(),
  team_option_id uuid not null references public.team_options(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete restrict,
  team public.team_side not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (team_option_id, player_id)
);

create table if not exists public.team_option_guests (
  id uuid primary key default gen_random_uuid(),
  team_option_id uuid not null references public.team_options(id) on delete cascade,
  guest_id uuid not null references public.match_guests(id) on delete cascade,
  team public.team_side not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (team_option_id, guest_id)
);

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_name = 'matches_confirmed_option_id_fkey'
      and table_name = 'matches'
  ) then
    alter table public.matches
      add constraint matches_confirmed_option_id_fkey
      foreign key (confirmed_option_id) references public.team_options(id) on delete set null;
  end if;
end
$$;

create table if not exists public.match_result (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references public.matches(id) on delete cascade,
  score_a integer not null check (score_a >= 0),
  score_b integer not null check (score_b >= 0),
  winner_team public.winner_team not null,
  notes text,
  created_by uuid not null references public.admins(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.rating_history (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  rating_before numeric(10,2) not null,
  rating_after numeric(10,2) not null,
  delta numeric(10,2) not null,
  reason text not null default 'match_result',
  created_at timestamptz not null default timezone('utc', now()),
  unique (match_id, player_id, reason)
);

create table if not exists public.match_player_stats (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  goals integer not null default 0 check (goals >= 0),
  assists integer not null default 0 check (assists >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (match_id, player_id)
);

create index if not exists idx_players_current_rating on public.players(current_rating desc);
create index if not exists idx_players_active on public.players(active);

create index if not exists idx_matches_status_scheduled_at on public.matches(status, scheduled_at desc);
create index if not exists idx_matches_scheduled_at on public.matches(scheduled_at desc);
create index if not exists idx_matches_created_by on public.matches(created_by);

create index if not exists idx_match_players_match_id on public.match_players(match_id);
create index if not exists idx_match_players_player_id on public.match_players(player_id);
create index if not exists idx_match_guests_match_id on public.match_guests(match_id);

create index if not exists idx_team_options_match_id on public.team_options(match_id);
create index if not exists idx_team_options_confirmed on public.team_options(match_id, is_confirmed);
create unique index if not exists idx_team_options_single_confirmed
  on public.team_options(match_id)
  where is_confirmed;

create index if not exists idx_team_option_players_option_id on public.team_option_players(team_option_id);
create index if not exists idx_team_option_players_player_id on public.team_option_players(player_id);
create index if not exists idx_team_option_guests_option_id on public.team_option_guests(team_option_id);
create index if not exists idx_team_option_guests_guest_id on public.team_option_guests(guest_id);

create index if not exists idx_match_result_match_id on public.match_result(match_id);
create index if not exists idx_rating_history_player_id_created_at on public.rating_history(player_id, created_at desc);
create index if not exists idx_rating_history_match_id on public.rating_history(match_id);
create index if not exists idx_match_player_stats_match_player on public.match_player_stats(match_id, player_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_players_updated_at on public.players;
create trigger trg_players_updated_at
before update on public.players
for each row
execute function public.set_updated_at();

drop trigger if exists trg_matches_updated_at on public.matches;
create trigger trg_matches_updated_at
before update on public.matches
for each row
execute function public.set_updated_at();

drop trigger if exists trg_match_result_updated_at on public.match_result;
create trigger trg_match_result_updated_at
before update on public.match_result
for each row
execute function public.set_updated_at();

drop trigger if exists trg_match_player_stats_updated_at on public.match_player_stats;
create trigger trg_match_player_stats_updated_at
before update on public.match_player_stats
for each row
execute function public.set_updated_at();

create or replace view public.public_match_cards
with (security_invoker = true) as
select
  m.id,
  m.modality,
  m.scheduled_at,
  m.status,
  (
    select array_agg(member.member_name order by member.member_rating desc)
    from (
      select p.full_name as member_name, p.current_rating as member_rating
      from public.team_option_players topa
      join public.players p on p.id = topa.player_id
      where topa.team_option_id = m.confirmed_option_id and topa.team = 'A'
      union all
      select mg.guest_name as member_name, mg.guest_rating as member_rating
      from public.team_option_guests toga
      join public.match_guests mg on mg.id = toga.guest_id
      where toga.team_option_id = m.confirmed_option_id and toga.team = 'A'
    ) as member
  ) as team_a_players,
  (
    select array_agg(member.member_name order by member.member_rating desc)
    from (
      select p.full_name as member_name, p.current_rating as member_rating
      from public.team_option_players topb
      join public.players p on p.id = topb.player_id
      where topb.team_option_id = m.confirmed_option_id and topb.team = 'B'
      union all
      select mg.guest_name as member_name, mg.guest_rating as member_rating
      from public.team_option_guests togb
      join public.match_guests mg on mg.id = togb.guest_id
      where togb.team_option_id = m.confirmed_option_id and togb.team = 'B'
    ) as member
  ) as team_b_players,
  mr.score_a,
  mr.score_b,
  mr.winner_team
from public.matches m
left join public.match_result mr on mr.match_id = m.id;
