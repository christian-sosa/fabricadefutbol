-- RLS and grants for Fabrica de Futbol

grant usage on schema public to anon, authenticated;
grant select on table public.organizations, public.players, public.matches, public.match_players, public.match_guests, public.team_options, public.team_option_players, public.team_option_guests, public.match_result, public.rating_history, public.match_player_stats, public.public_match_cards to anon, authenticated;
grant select, insert, update, delete on table public.admins, public.organization_admins, public.organization_invites, public.organizations, public.players, public.matches, public.match_players, public.match_guests, public.team_options, public.team_option_players, public.team_option_guests, public.match_result, public.rating_history, public.match_player_stats to authenticated;

create or replace function public.current_user_email()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce((select u.email from auth.users u where u.id = auth.uid()), ''));
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_email() = 'sosa.christian.agustin@gmail.com';
$$;

create or replace function public.is_org_admin(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or exists (
      select 1
      from public.organization_admins oa
      where oa.organization_id = org_id
        and oa.admin_id = auth.uid()
    )
    or exists (
      select 1
      from public.organizations o
      where o.id = org_id
        and o.created_by = auth.uid()
    );
$$;

create or replace function public.can_read_org(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organizations o
    where o.id = org_id
      and o.is_public = true
  )
  or public.is_org_admin(org_id);
$$;

create or replace function public.can_create_organization()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null;
$$;

create or replace function public.org_has_admin_slot(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (
    (
      select count(*)
      from public.organization_admins oa
      where oa.organization_id = org_id
    ) + (
      select count(*)
      from public.organization_invites oi
      where oi.organization_id = org_id
        and oi.status = 'pending'
    )
  ) < 4;
$$;

revoke all on function public.current_user_email() from public;
revoke all on function public.is_super_admin() from public;
revoke all on function public.is_org_admin(uuid) from public;
revoke all on function public.can_read_org(uuid) from public;
revoke all on function public.can_create_organization() from public;
revoke all on function public.org_has_admin_slot(uuid) from public;
grant execute on function public.current_user_email() to anon, authenticated;
grant execute on function public.is_super_admin() to anon, authenticated;
grant execute on function public.is_org_admin(uuid) to anon, authenticated;
grant execute on function public.can_read_org(uuid) to anon, authenticated;
grant execute on function public.can_create_organization() to anon, authenticated;
grant execute on function public.org_has_admin_slot(uuid) to anon, authenticated;

alter table public.admins enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_admins enable row level security;
alter table public.organization_invites enable row level security;
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

drop policy if exists admins_select_self_or_super on public.admins;
create policy admins_select_self_or_super
on public.admins
for select
to authenticated
using (id = auth.uid() or public.is_super_admin());

drop policy if exists admins_insert_self_or_super on public.admins;
create policy admins_insert_self_or_super
on public.admins
for insert
to authenticated
with check (id = auth.uid() or public.is_super_admin());

drop policy if exists admins_update_self_or_super on public.admins;
create policy admins_update_self_or_super
on public.admins
for update
to authenticated
using (id = auth.uid() or public.is_super_admin())
with check (id = auth.uid() or public.is_super_admin());

drop policy if exists admins_delete_super_only on public.admins;
create policy admins_delete_super_only
on public.admins
for delete
to authenticated
using (public.is_super_admin());

drop policy if exists organizations_public_read on public.organizations;
create policy organizations_public_read
on public.organizations
for select
to anon, authenticated
using (is_public or public.is_org_admin(id));

drop policy if exists organizations_insert_authenticated on public.organizations;
create policy organizations_insert_authenticated
on public.organizations
for insert
to authenticated
with check (
  (created_by = auth.uid() or public.is_super_admin())
  and public.can_create_organization()
);

drop policy if exists organizations_update_admin on public.organizations;
create policy organizations_update_admin
on public.organizations
for update
to authenticated
using (public.is_org_admin(id))
with check (public.is_org_admin(id));

drop policy if exists organizations_delete_super on public.organizations;
create policy organizations_delete_super
on public.organizations
for delete
to authenticated
using (public.is_super_admin());

drop policy if exists organization_admins_select on public.organization_admins;
create policy organization_admins_select
on public.organization_admins
for select
to authenticated
using (admin_id = auth.uid() or public.is_org_admin(organization_id));

drop policy if exists organization_admins_insert on public.organization_admins;
create policy organization_admins_insert
on public.organization_admins
for insert
to authenticated
with check (
  (
    public.is_org_admin(organization_id)
    and public.org_has_admin_slot(organization_id)
  )
  or (
    admin_id = auth.uid()
    and exists (
      select 1
      from public.organization_invites i
      where i.organization_id = organization_admins.organization_id
        and lower(i.email) = public.current_user_email()
        and i.status = 'pending'
    )
  )
);

drop policy if exists organization_admins_delete on public.organization_admins;
create policy organization_admins_delete
on public.organization_admins
for delete
to authenticated
using (public.is_org_admin(organization_id) or admin_id = auth.uid());

drop policy if exists organization_invites_select on public.organization_invites;
create policy organization_invites_select
on public.organization_invites
for select
to authenticated
using (
  public.is_org_admin(organization_id)
  or lower(email) = public.current_user_email()
);

drop policy if exists organization_invites_insert on public.organization_invites;
create policy organization_invites_insert
on public.organization_invites
for insert
to authenticated
with check (
  public.is_org_admin(organization_id)
  and public.org_has_admin_slot(organization_id)
);

drop policy if exists organization_invites_update on public.organization_invites;
create policy organization_invites_update
on public.organization_invites
for update
to authenticated
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

drop policy if exists organization_invites_delete on public.organization_invites;
create policy organization_invites_delete
on public.organization_invites
for delete
to authenticated
using (
  public.is_org_admin(organization_id)
  or (
    status = 'pending'
    and lower(email) = public.current_user_email()
  )
);

drop policy if exists players_public_read on public.players;
create policy players_public_read
on public.players
for select
to anon, authenticated
using (public.can_read_org(organization_id));

drop policy if exists players_admin_write on public.players;
create policy players_admin_write
on public.players
for all
to authenticated
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

drop policy if exists matches_public_read on public.matches;
create policy matches_public_read
on public.matches
for select
to anon, authenticated
using (
  (
    status in ('confirmed', 'finished', 'cancelled')
    and public.can_read_org(organization_id)
  )
  or public.is_org_admin(organization_id)
);

drop policy if exists matches_admin_write on public.matches;
create policy matches_admin_write
on public.matches
for all
to authenticated
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

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
      and (
        (
          m.status in ('confirmed', 'finished', 'cancelled')
          and public.can_read_org(m.organization_id)
        )
        or public.is_org_admin(m.organization_id)
      )
  )
);

drop policy if exists match_players_admin_write on public.match_players;
create policy match_players_admin_write
on public.match_players
for all
to authenticated
using (
  exists (
    select 1
    from public.matches m
    where m.id = match_players.match_id
      and public.is_org_admin(m.organization_id)
  )
)
with check (
  exists (
    select 1
    from public.matches m
    where m.id = match_players.match_id
      and public.is_org_admin(m.organization_id)
  )
);

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
      and (
        (
          m.status in ('confirmed', 'finished', 'cancelled')
          and public.can_read_org(m.organization_id)
        )
        or public.is_org_admin(m.organization_id)
      )
  )
);

drop policy if exists match_guests_admin_write on public.match_guests;
create policy match_guests_admin_write
on public.match_guests
for all
to authenticated
using (
  exists (
    select 1
    from public.matches m
    where m.id = match_guests.match_id
      and public.is_org_admin(m.organization_id)
  )
)
with check (
  exists (
    select 1
    from public.matches m
    where m.id = match_guests.match_id
      and public.is_org_admin(m.organization_id)
  )
);

drop policy if exists team_options_public_read on public.team_options;
create policy team_options_public_read
on public.team_options
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.matches m
    where m.id = team_options.match_id
      and (
        (
          team_options.is_confirmed
          and public.can_read_org(m.organization_id)
        )
        or public.is_org_admin(m.organization_id)
      )
  )
);

drop policy if exists team_options_admin_write on public.team_options;
create policy team_options_admin_write
on public.team_options
for all
to authenticated
using (
  exists (
    select 1
    from public.matches m
    where m.id = team_options.match_id
      and public.is_org_admin(m.organization_id)
  )
)
with check (
  exists (
    select 1
    from public.matches m
    where m.id = team_options.match_id
      and public.is_org_admin(m.organization_id)
  )
);

drop policy if exists team_option_players_public_read on public.team_option_players;
create policy team_option_players_public_read
on public.team_option_players
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.team_options opt
    join public.matches m on m.id = opt.match_id
    where opt.id = team_option_players.team_option_id
      and (
        (
          opt.is_confirmed
          and public.can_read_org(m.organization_id)
        )
        or public.is_org_admin(m.organization_id)
      )
  )
);

drop policy if exists team_option_players_admin_write on public.team_option_players;
create policy team_option_players_admin_write
on public.team_option_players
for all
to authenticated
using (
  exists (
    select 1
    from public.team_options opt
    join public.matches m on m.id = opt.match_id
    where opt.id = team_option_players.team_option_id
      and public.is_org_admin(m.organization_id)
  )
)
with check (
  exists (
    select 1
    from public.team_options opt
    join public.matches m on m.id = opt.match_id
    where opt.id = team_option_players.team_option_id
      and public.is_org_admin(m.organization_id)
  )
);

drop policy if exists team_option_guests_public_read on public.team_option_guests;
create policy team_option_guests_public_read
on public.team_option_guests
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.team_options opt
    join public.matches m on m.id = opt.match_id
    where opt.id = team_option_guests.team_option_id
      and (
        (
          opt.is_confirmed
          and public.can_read_org(m.organization_id)
        )
        or public.is_org_admin(m.organization_id)
      )
  )
);

drop policy if exists team_option_guests_admin_write on public.team_option_guests;
create policy team_option_guests_admin_write
on public.team_option_guests
for all
to authenticated
using (
  exists (
    select 1
    from public.team_options opt
    join public.matches m on m.id = opt.match_id
    where opt.id = team_option_guests.team_option_id
      and public.is_org_admin(m.organization_id)
  )
)
with check (
  exists (
    select 1
    from public.team_options opt
    join public.matches m on m.id = opt.match_id
    where opt.id = team_option_guests.team_option_id
      and public.is_org_admin(m.organization_id)
  )
);

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
      and (
        (
          m.status = 'finished'
          and public.can_read_org(m.organization_id)
        )
        or public.is_org_admin(m.organization_id)
      )
  )
);

drop policy if exists match_result_admin_write on public.match_result;
create policy match_result_admin_write
on public.match_result
for all
to authenticated
using (
  exists (
    select 1
    from public.matches m
    where m.id = match_result.match_id
      and public.is_org_admin(m.organization_id)
  )
)
with check (
  exists (
    select 1
    from public.matches m
    where m.id = match_result.match_id
      and public.is_org_admin(m.organization_id)
  )
);

drop policy if exists rating_history_public_read on public.rating_history;
create policy rating_history_public_read
on public.rating_history
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.matches m
    where m.id = rating_history.match_id
      and public.can_read_org(m.organization_id)
  )
);

drop policy if exists rating_history_admin_write on public.rating_history;
create policy rating_history_admin_write
on public.rating_history
for all
to authenticated
using (
  exists (
    select 1
    from public.matches m
    where m.id = rating_history.match_id
      and public.is_org_admin(m.organization_id)
  )
)
with check (
  exists (
    select 1
    from public.matches m
    where m.id = rating_history.match_id
      and public.is_org_admin(m.organization_id)
  )
);

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
      and (
        (
          m.status = 'finished'
          and public.can_read_org(m.organization_id)
        )
        or public.is_org_admin(m.organization_id)
      )
  )
);

drop policy if exists match_player_stats_admin_write on public.match_player_stats;
create policy match_player_stats_admin_write
on public.match_player_stats
for all
to authenticated
using (
  exists (
    select 1
    from public.matches m
    where m.id = match_player_stats.match_id
      and public.is_org_admin(m.organization_id)
  )
)
with check (
  exists (
    select 1
    from public.matches m
    where m.id = match_player_stats.match_id
      and public.is_org_admin(m.organization_id)
  )
);

create or replace function public.can_manage_player_photo_object(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.players p
    where p.organization_id::text = split_part(object_name, '/', 1)
      and p.id::text = split_part(split_part(object_name, '/', 2), '.', 1)
      and split_part(object_name, '/', 2) <> ''
      and public.is_org_admin(p.organization_id)
  );
$$;

revoke all on function public.can_manage_player_photo_object(text) from public;
grant execute on function public.can_manage_player_photo_object(text) to anon, authenticated;

drop policy if exists storage_player_photos_public_read on storage.objects;
create policy storage_player_photos_public_read
on storage.objects
for select
to public
using (bucket_id = 'player-photos');

drop policy if exists storage_player_photos_insert_admin on storage.objects;
create policy storage_player_photos_insert_admin
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'player-photos'
  and lower(right(name, 5)) = '.webp'
  and public.can_manage_player_photo_object(name)
);

drop policy if exists storage_player_photos_update_admin on storage.objects;
create policy storage_player_photos_update_admin
on storage.objects
for update
to authenticated
using (
  bucket_id = 'player-photos'
  and public.can_manage_player_photo_object(name)
)
with check (
  bucket_id = 'player-photos'
  and lower(right(name, 5)) = '.webp'
  and public.can_manage_player_photo_object(name)
);

drop policy if exists storage_player_photos_delete_admin on storage.objects;
create policy storage_player_photos_delete_admin
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'player-photos'
  and public.can_manage_player_photo_object(name)
);
