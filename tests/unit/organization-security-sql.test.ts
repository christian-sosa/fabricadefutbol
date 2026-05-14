import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const schemaSqlPath = path.join(root, "supabase", "schema.sql");
const policiesSqlPath = path.join(root, "supabase", "policies.sql");
const hasSupabaseSql = existsSync(schemaSqlPath) && existsSync(policiesSqlPath);
const schemaSql = hasSupabaseSql ? readFileSync(schemaSqlPath, "utf8") : "";
const policiesSql = hasSupabaseSql ? readFileSync(policiesSqlPath, "utf8") : "";
const describeSupabaseSql = hasSupabaseSql ? describe : describe.skip;

describeSupabaseSql("organization security sql", () => {
  it("centraliza escrituras de grupos en la ventana comercial activa", () => {
    expect(policiesSql).toContain("create or replace function public.can_write_org");
    expect(policiesSql).toContain("o.created_at + interval '30 days' >= timezone('utc', now())");
    expect(policiesSql).toContain("lower(s.status) = 'active'");
    expect(policiesSql).toContain("using (public.can_write_org(organization_id))");
    expect(policiesSql).toContain("and public.can_write_org(m.organization_id)");
    expect(policiesSql).toContain("%1$I.can_write_org(p.organization_id)");
    expect(policiesSql).toContain("%1$I.can_write_org(o.id)");
  });

  it("bloquea altas duplicadas y aceptaciones de invitaciones vencidas", () => {
    expect(policiesSql).toContain("create or replace function public.can_create_organization");
    expect(policiesSql).toContain("from public.organization_admins oa");
    expect(policiesSql).toContain("and public.org_has_admin_slot(organization_id)");
    expect(policiesSql).toContain("and i.expires_at > timezone('utc', now())");
    expect(policiesSql).toContain("and oi.expires_at > timezone('utc', now())");
  });

  it("refuerza el maximo de admins activos aunque la escritura use service role", () => {
    expect(schemaSql).toContain("create or replace function public.enforce_organization_admin_limit");
    expect(schemaSql).toContain("from public.organization_admins oa");
    expect(schemaSql).toContain("where oa.organization_id = new.organization_id");
    expect(schemaSql).toContain("if current_count >= 4 then");
    expect(schemaSql).toContain("Cada grupo admite hasta 4 administradores activos.");
    expect(schemaSql).toContain("drop trigger if exists trg_organization_admins_limit on public.organization_admins;");
    expect(schemaSql).toContain("before insert or update of organization_id on public.organization_admins");
    expect(schemaSql).toContain("execute function public.enforce_organization_admin_limit();");
  });

  it("mantiene aplicacion de pagos atomica e inmutable la fecha de alta", () => {
    expect(schemaSql).toContain("create or replace function public.apply_organization_billing_payment_period");
    expect(schemaSql).toContain("for update;");
    expect(schemaSql).toContain("create or replace function public.prevent_organization_security_column_changes");
    expect(schemaSql).toContain("before update of created_at, created_by on public.organizations");
    expect(policiesSql).toContain("grant execute on function public.apply_organization_billing_payment_period");
  });

  it("agrega auditoria append-only para eventos sensibles de grupos", () => {
    expect(schemaSql).toContain("create table if not exists public.organization_audit_events");
    expect(schemaSql).toContain("event_type text not null");
    expect(schemaSql).toContain("details jsonb not null default '{}'::jsonb");
    expect(policiesSql).toContain("alter table public.organization_audit_events enable row level security");
    expect(policiesSql).toMatch(
      /grant select on table[\s\S]*public\.organization_audit_events[\s\S]*to authenticated/
    );
    expect(policiesSql).not.toContain("grant select, insert, update, delete on table public.organization_audit_events to authenticated");
    expect(policiesSql).toContain("create policy organization_audit_events_select");
    expect(policiesSql).toContain("using (public.is_super_admin() or public.is_org_admin(organization_id))");
  });
});
