import { AdminNav } from "@/components/admin/admin-nav";
import { SignOutButton } from "@/components/admin/sign-out-button";
import { requireAdminSession } from "@/lib/auth/admin";

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminSession();

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-[0_18px_40px_-28px_rgba(16,185,129,0.65)]">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">Modo administrador</p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-black text-slate-100">Hola, {admin.displayName}</h1>
            <p className="text-sm text-slate-400">
              Gestiona organizaciones y torneos desde paneles separados para no mezclar flujos.
            </p>
          </div>
          <SignOutButton />
        </div>
        <div className="mt-4">
          <AdminNav isSuperAdmin={admin.isSuperAdmin} />
        </div>
      </section>

      {children}
    </div>
  );
}
