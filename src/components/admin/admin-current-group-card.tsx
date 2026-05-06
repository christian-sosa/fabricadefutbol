import Link from "next/link";

import { adminContextActionLinkClass } from "@/components/admin/admin-context-actions";
import { AdminSubnav } from "@/components/admin/admin-subnav";
import { SignOutButton } from "@/components/admin/sign-out-button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import type { AdminSession } from "@/lib/auth/admin";

type AdminCurrentGroupCardProps = {
  admin: AdminSession;
  organization: {
    name: string;
    slug: string;
  };
};

export function AdminCurrentGroupCard({ admin, organization }: AdminCurrentGroupCardProps) {
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">
                Modo administrador / {admin.displayName}
              </p>
              <p className="text-sm text-slate-400">{admin.email}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">
                Grupo actual
              </p>
              <CardTitle className="mt-2">{organization.name}</CardTitle>
              <CardDescription className="mt-2">
                Estas administrando este grupo. Los jugadores, partidos, rendimiento, imagen y
                configuracion se guardan aca.
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {admin.isSuperAdmin ? (
              <Link className={adminContextActionLinkClass} href="/admin/super">
                Super Admin
              </Link>
            ) : null}
            <Link className={adminContextActionLinkClass} href="/admin">
              Cambiar espacio
            </Link>
            <SignOutButton />
          </div>
        </div>
      </Card>
      <AdminSubnav scope="organizations" />
    </div>
  );
}
