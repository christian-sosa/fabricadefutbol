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

drop policy if exists storage_player_photos_public_read on storage.objects;
create policy storage_player_photos_public_read
on storage.objects
for select
to public
using (bucket_id in ('player-photos', 'player-photos-dev'));

drop policy if exists storage_player_photos_insert_admin on storage.objects;
create policy storage_player_photos_insert_admin
on storage.objects
for insert
to authenticated
with check (
  bucket_id in ('player-photos', 'player-photos-dev')
  and lower(right(name, 5)) = '.webp'
  and public.can_manage_player_photo_object(name)
);

drop policy if exists storage_player_photos_update_admin on storage.objects;
create policy storage_player_photos_update_admin
on storage.objects
for update
to authenticated
using (
  bucket_id in ('player-photos', 'player-photos-dev')
  and public.can_manage_player_photo_object(name)
)
with check (
  bucket_id in ('player-photos', 'player-photos-dev')
  and lower(right(name, 5)) = '.webp'
  and public.can_manage_player_photo_object(name)
);

drop policy if exists storage_player_photos_delete_admin on storage.objects;
create policy storage_player_photos_delete_admin
on storage.objects
for delete
to authenticated
using (
  bucket_id in ('player-photos', 'player-photos-dev')
  and public.can_manage_player_photo_object(name)
);
