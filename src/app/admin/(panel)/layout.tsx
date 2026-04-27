import Link from "next/link";

import { AdminSubnav } from "@/components/admin/admin-subnav";
import { SignOutButton } from "@/components/admin/sign-out-button";
import { requireAdminSession } from "@/lib/auth/admin";

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminSession();

  return (
    <div className="space-y-4">
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

      <AdminSubnav scope="tournaments" />

      {children}
    </div>
  );
}
