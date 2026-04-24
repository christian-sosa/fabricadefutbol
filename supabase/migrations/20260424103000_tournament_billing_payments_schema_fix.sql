-- Reconcile tournament billing storage across the schemas this app can use.
-- The app selects its PostgREST schema dynamically (`public`, `app_dev`, or `app_prod`),
-- so the billing table must exist in the active schema, not only in `public`.

do $$
declare
  target_schema text;
begin
  for target_schema in
    select schema_name
    from information_schema.schemata
    where schema_name in ('public', 'app_dev', 'app_prod')
  loop
    if exists (
      select 1
      from information_schema.tables
      where table_schema = target_schema
        and table_name = 'admins'
    ) and exists (
      select 1
      from information_schema.tables
      where table_schema = target_schema
        and table_name = 'tournaments'
    ) then
      execute format(
        'create table if not exists %1$I.tournament_billing_payments (
          id uuid primary key default gen_random_uuid(),
          admin_id uuid not null references %1$I.admins(id) on delete cascade,
          requested_tournament_name text not null,
          requested_tournament_slug text not null,
          created_tournament_id uuid references %1$I.tournaments(id) on delete set null,
          amount numeric(12,2) not null check (amount > 0),
          currency_id text not null,
          status text not null default ''pending'',
          mp_external_reference text not null unique,
          mp_payment_id text unique,
          mp_preference_id text,
          checkout_url text,
          checkout_sandbox_url text,
          approved_at timestamptz,
          raw_payment jsonb,
          created_at timestamptz not null default timezone(''utc'', now()),
          updated_at timestamptz not null default timezone(''utc'', now())
        )',
        target_schema
      );

      if not exists (
        select 1
        from information_schema.table_constraints
        where table_schema = target_schema
          and table_name = 'tournament_billing_payments'
          and constraint_name = 'tournament_billing_payments_status_check'
      ) then
        execute format(
          'alter table %1$I.tournament_billing_payments
             add constraint tournament_billing_payments_status_check
             check (
               lower(status) in (
                 ''pending'',
                 ''approved'',
                 ''in_process'',
                 ''rejected'',
                 ''cancelled'',
                 ''refunded'',
                 ''chargeback'',
                 ''unknown''
               )
             )',
          target_schema
        );
      end if;

      execute format(
        'create index if not exists idx_tournament_billing_payments_admin_created_at
           on %1$I.tournament_billing_payments (admin_id, created_at desc)',
        target_schema
      );
      execute format(
        'create index if not exists idx_tournament_billing_payments_created_tournament
           on %1$I.tournament_billing_payments (created_tournament_id)',
        target_schema
      );

      execute format('revoke all on table %1$I.tournament_billing_payments from anon', target_schema);
      execute format(
        'revoke insert, update, delete on table %1$I.tournament_billing_payments from authenticated',
        target_schema
      );
      execute format('grant select on table %1$I.tournament_billing_payments to authenticated', target_schema);
      execute format(
        'grant select, insert, update, delete on table %1$I.tournament_billing_payments to service_role',
        target_schema
      );
      execute format('alter table %1$I.tournament_billing_payments enable row level security', target_schema);

      execute format(
        'drop policy if exists tournament_billing_payments_select on %1$I.tournament_billing_payments',
        target_schema
      );
      execute format(
        'create policy tournament_billing_payments_select
           on %1$I.tournament_billing_payments
           for select
           to authenticated
           using (
             admin_id = auth.uid()
             or (
               created_tournament_id is not null
               and %1$I.is_tournament_admin(created_tournament_id)
             )
           )',
        target_schema
      );

      execute format(
        'drop policy if exists tournament_billing_payments_insert on %1$I.tournament_billing_payments',
        target_schema
      );
      execute format(
        'drop policy if exists tournament_billing_payments_update on %1$I.tournament_billing_payments',
        target_schema
      );
      execute format(
        'drop policy if exists tournament_billing_payments_delete on %1$I.tournament_billing_payments',
        target_schema
      );

      if exists (
        select 1
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = target_schema
          and p.proname = 'set_updated_at'
          and pg_get_function_identity_arguments(p.oid) = ''
      ) then
        execute format(
          'drop trigger if exists trg_tournament_billing_payments_updated_at on %1$I.tournament_billing_payments',
          target_schema
        );
        execute format(
          'create trigger trg_tournament_billing_payments_updated_at
             before update on %1$I.tournament_billing_payments
             for each row
             execute function %1$I.set_updated_at()',
          target_schema
        );
      end if;
    end if;
  end loop;
end
$$;
