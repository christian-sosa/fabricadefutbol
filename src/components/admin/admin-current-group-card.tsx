import Link from "next/link";

import { adminContextActionLinkClass } from "@/components/admin/admin-context-actions";
import { AdminSubnav } from "@/components/admin/admin-subnav";
import type { AdminSession } from "@/lib/auth/admin";

type AdminCurrentGroupCardProps = {
  admin: AdminSession;
  organization: {
    name: string;
    slug: string;
  };
  titleAs?: "h1" | "h2";
};

export function AdminCurrentGroupCard({ admin, organization, titleAs: Title = "h2" }: AdminCurrentGroupCardProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/80">
      <div className="bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
                Grupo actual
              </p>
              <Title className="mt-2 break-words text-3xl font-black tracking-tight text-white sm:text-4xl">{organization.name}</Title>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">Jugadores, partidos e historial de tu grupo, en un solo lugar.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {admin.isSuperAdmin ? (
              <Link className={adminContextActionLinkClass} href="/admin/super">
                Super Admin
              </Link>
            ) : null}
            <Link className={adminContextActionLinkClass} href="/admin?view=groups">
              Cambiar grupo
            </Link>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-1 border-t border-slate-800 pt-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>Modo administrador / {admin.displayName}</p>
          <p className="break-all">{admin.email}</p>
        </div>
      </div>
      <AdminSubnav />
    </div>
  );
}
