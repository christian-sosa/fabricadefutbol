-- Billing tables live in the exposed `public` schema, so they must always have
-- RLS enabled. These tables are only meant to be read by org admins/super admin
-- and written by service_role-backed server flows.

revoke all on table public.organization_billing_subscriptions from anon;
revoke all on table public.organization_billing_payments from anon;

revoke insert, update, delete on table public.organization_billing_subscriptions from authenticated;
revoke insert, update, delete on table public.organization_billing_payments from authenticated;

grant select on table public.organization_billing_subscriptions, public.organization_billing_payments to authenticated;
grant select, insert, update, delete on table public.organization_billing_subscriptions, public.organization_billing_payments to service_role;

alter table public.organization_billing_subscriptions enable row level security;
alter table public.organization_billing_payments enable row level security;

drop policy if exists organization_billing_subscriptions_select on public.organization_billing_subscriptions;
create policy organization_billing_subscriptions_select
on public.organization_billing_subscriptions
for select
to authenticated
using (public.is_org_admin(organization_id));

drop policy if exists organization_billing_subscriptions_insert on public.organization_billing_subscriptions;
drop policy if exists organization_billing_subscriptions_update on public.organization_billing_subscriptions;
drop policy if exists organization_billing_subscriptions_delete on public.organization_billing_subscriptions;

drop policy if exists organization_billing_payments_select on public.organization_billing_payments;
create policy organization_billing_payments_select
on public.organization_billing_payments
for select
to authenticated
using (public.is_org_admin(organization_id));

drop policy if exists organization_billing_payments_insert on public.organization_billing_payments;
drop policy if exists organization_billing_payments_update on public.organization_billing_payments;
drop policy if exists organization_billing_payments_delete on public.organization_billing_payments;
