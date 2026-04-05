-- Supabase schema for Fabrica de Futbol
create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'match_modality') then
    create type public.match_modality as enum ('5v5', '6v6', '7v7', '9v9', '11v11');
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
  if not exists (select 1 from pg_type where typname = 'invite_status') then
    create type public.invite_status as enum ('pending', 'accepted', 'revoked');
  end if;
end
$$;

do $$
begin
  alter type public.match_modality add value if not exists '5v5';
  alter type public.match_modality add value if not exists '6v6';
  alter type public.match_modality add value if not exists '7v7';
  alter type public.match_modality add value if not exists '9v9';
  alter type public.match_modality add value if not exists '11v11';
end
$$;

create table if not exists public.admins (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  is_public boolean not null default true,
  created_by uuid references public.admins(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'organizations'
      and constraint_name = 'organizations_is_public_true_check'
  ) then
    alter table public.organizations
      add constraint organizations_is_public_true_check
      check (is_public = true);
  end if;
end
$$;

create unique index if not exists idx_organizations_name on public.organizations (lower(name));
create unique index if not exists idx_organizations_slug on public.organizations (lower(slug));

create table if not exists public.organization_admins (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  admin_id uuid not null references public.admins(id) on delete cascade,
  created_by uuid references public.admins(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, admin_id)
);

create table if not exists public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  invite_token uuid not null default gen_random_uuid(),
  invited_by uuid not null references public.admins(id) on delete cascade,
  status public.invite_status not null default 'pending',
  accepted_by uuid references public.admins(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organization_invites'
      and column_name = 'invite_token'
  ) then
    alter table public.organization_invites
      add column invite_token uuid;
    update public.organization_invites
    set invite_token = gen_random_uuid()
    where invite_token is null;
    alter table public.organization_invites
      alter column invite_token set not null;
    alter table public.organization_invites
      alter column invite_token set default gen_random_uuid();
  end if;
end
$$;

create unique index if not exists idx_org_invites_unique_pending
  on public.organization_invites (organization_id, lower(email))
  where status = 'pending';
create unique index if not exists idx_org_invites_token
  on public.organization_invites (invite_token);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  full_name text not null,
  initial_rank integer not null check (initial_rank > 0),
  current_rating numeric(8,2) not null default 1000.00 check (current_rating > 0),
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
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

insert into public.organizations (id, name, slug, is_public, created_by)
select '00000000-0000-0000-0000-000000000001'::uuid, 'Fabrica Base', 'fabrica-base', true, null
where not exists (
  select 1
  from public.organizations
  where id = '00000000-0000-0000-0000-000000000001'::uuid
);

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'players' and column_name = 'organization_id'
  ) then
    alter table public.players add column organization_id uuid;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'matches' and column_name = 'organization_id'
  ) then
    alter table public.matches add column organization_id uuid;
  end if;
end
$$;

update public.players
set organization_id = '00000000-0000-0000-0000-000000000001'::uuid
where organization_id is null;

update public.matches
set organization_id = '00000000-0000-0000-0000-000000000001'::uuid
where organization_id is null;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_name = 'players_organization_id_fkey'
      and table_schema = 'public'
      and table_name = 'players'
  ) then
    alter table public.players
      add constraint players_organization_id_fkey
      foreign key (organization_id) references public.organizations(id) on delete cascade;
  end if;

  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_name = 'matches_organization_id_fkey'
      and table_schema = 'public'
      and table_name = 'matches'
  ) then
    alter table public.matches
      add constraint matches_organization_id_fkey
      foreign key (organization_id) references public.organizations(id) on delete cascade;
  end if;
end
$$;

alter table public.players alter column organization_id set not null;
alter table public.matches alter column organization_id set not null;

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'players_full_name_key') then
    alter table public.players drop constraint players_full_name_key;
  end if;
  if exists (select 1 from pg_constraint where conname = 'players_initial_rank_key') then
    alter table public.players drop constraint players_initial_rank_key;
  end if;
end
$$;

create unique index if not exists idx_players_org_full_name on public.players (organization_id, lower(full_name));
create unique index if not exists idx_players_org_initial_rank on public.players (organization_id, initial_rank);

insert into public.organization_admins (organization_id, admin_id, created_by)
select '00000000-0000-0000-0000-000000000001'::uuid, a.id, a.id
from public.admins a
on conflict (organization_id, admin_id) do nothing;

create index if not exists idx_org_admins_org on public.organization_admins(organization_id);
create index if not exists idx_org_admins_admin on public.organization_admins(admin_id);
create index if not exists idx_org_invites_org on public.organization_invites(organization_id);
create index if not exists idx_org_invites_email on public.organization_invites(lower(email));

create index if not exists idx_players_org_rating on public.players(organization_id, current_rating desc);
create index if not exists idx_players_org_active on public.players(organization_id, active);

create index if not exists idx_matches_org_status_scheduled_at on public.matches(organization_id, status, scheduled_at desc);
create index if not exists idx_matches_org_scheduled_at on public.matches(organization_id, scheduled_at desc);
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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'player-photos',
  'player-photos',
  true,
  10485760,
  array['image/webp']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.enforce_max_players_per_org()
returns trigger
language plpgsql
as $$
declare
  current_count integer;
begin
  if tg_op = 'INSERT' then
    select count(*) into current_count
    from public.players p
    where p.organization_id = new.organization_id;

    if current_count >= 30 then
      raise exception 'Cada organizacion admite un maximo de 30 jugadores.';
    end if;
  elsif tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    select count(*) into current_count
    from public.players p
    where p.organization_id = new.organization_id;

    if current_count >= 30 then
      raise exception 'Cada organizacion admite un maximo de 30 jugadores.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_organizations_updated_at on public.organizations;
create trigger trg_organizations_updated_at
before update on public.organizations
for each row
execute function public.set_updated_at();

drop trigger if exists trg_players_updated_at on public.players;
create trigger trg_players_updated_at
before update on public.players
for each row
execute function public.set_updated_at();

drop trigger if exists trg_players_max_per_org on public.players;
create trigger trg_players_max_per_org
before insert or update of organization_id on public.players
for each row
execute function public.enforce_max_players_per_org();

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
  mr.winner_team,
  m.organization_id
from public.matches m
left join public.match_result mr on mr.match_id = m.id;
