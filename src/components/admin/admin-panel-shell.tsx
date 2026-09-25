"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

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
    !pathname.startsWith("/admin/super");
  const isFocusedAdminContext = isGroupContext;

  return (
    <div className="space-y-5">
      {!isFocusedAdminContext ? (
        <section aria-label="Cuenta de administrador" className="rounded-2xl border border-slate-800 bg-slate-900/60 px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-200">
                Modo administrador / {admin.displayName}
              </p>
              <p className="mt-1 break-all text-xs text-slate-500">{admin.email}</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Link className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-700 px-3 text-sm text-slate-300 transition hover:bg-slate-800" href="/admin/security">Seguridad de la cuenta</Link>
              {admin.isSuperAdmin && !pathname.startsWith("/admin/super") ? (
                <Link
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-500/5 px-3 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/10"
                  href="/admin/super"
                >
                  Super Admin
                </Link>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}


      {children}
    </div>
  );
}
