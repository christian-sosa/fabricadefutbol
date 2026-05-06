"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { AdminSubnav } from "@/components/admin/admin-subnav";
import { SignOutButton } from "@/components/admin/sign-out-button";
import type { AdminSession } from "@/lib/auth/admin";

type AdminPanelShellProps = {
  admin: AdminSession;
  children: ReactNode;
};

export function AdminPanelShell({ admin, children }: AdminPanelShellProps) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const hasOrganizationContext = Boolean(searchParams.get("org"));
  const isGroupContext =
    hasOrganizationContext &&
    pathname.startsWith("/admin") &&
    !pathname.startsWith("/admin/tournaments") &&
    !pathname.startsWith("/admin/clubs") &&
    !pathname.startsWith("/admin/super");
  const isClubDetailContext = /^\/admin\/clubs\/[^/]+/.test(pathname);
  const isTournamentStandalonePage =
    pathname === "/admin/tournaments/billing" ||
    pathname === "/admin/tournaments/new" ||
    pathname.startsWith("/admin/tournaments/invite/");
  const isLeagueDetailContext = /^\/admin\/tournaments\/[^/]+/.test(pathname) && !isTournamentStandalonePage;
  const isLeagueRootContext = isLeagueDetailContext && /^\/admin\/tournaments\/[^/]+$/.test(pathname);
  const isFocusedAdminContext = isGroupContext || isClubDetailContext || isLeagueDetailContext;

  return (
    <div className="space-y-4">
      {!isFocusedAdminContext ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-[0_18px_40px_-28px_rgba(16,185,129,0.65)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">
                Modo administrador / {admin.displayName}
              </p>
              <p className="text-sm text-slate-400">{admin.email}</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {admin.isSuperAdmin ? (
                <Link
                  className="inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-800 md:text-sm"
                  href="/admin/super"
                >
                  Super Admin
                </Link>
              ) : null}
              <SignOutButton />
            </div>
          </div>
        </section>
      ) : null}

      {!isLeagueRootContext ? <AdminSubnav scope="tournaments" /> : null}

      {children}
    </div>
  );
}
